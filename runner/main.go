package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Pack builds set these at link time; request input cannot change them.
var binDirectory = "/opt/pentcloud-recon/bin"
var executableNames = "httpx,dnsx,katana,subfinder"
var runtimeHome = "/tmp/pentcloud-recon"
var allowFiles = "false"

const outputLimit = 2 * 1024 * 1024

type Input struct {
	Argv      []string             `json:"argv"`
	Stdin     string               `json:"stdin"`
	TimeoutMs int                  `json:"timeoutMs"`
	Files     map[string]FileInput `json:"files,omitempty"`
}
type FileInput struct {
	Base64 string `json:"base64"`
	SHA256 string `json:"sha256"`
}
type Result struct {
	Argv        []string          `json:"argv"`
	ExitCode    int               `json:"exitCode"`
	Stdout      string            `json:"stdout"`
	Stderr      string            `json:"stderr"`
	TimedOut    bool              `json:"timedOut"`
	Truncated   bool              `json:"truncated"`
	Error       string            `json:"error,omitempty"`
	ProcessMs   int64             `json:"processMs"`
	FirstJSONMs int64             `json:"firstJSONMs"`
	CPUUserMs   int64             `json:"cpuUserMs"`
	CPUSystemMs int64             `json:"cpuSystemMs"`
	MaxRSSKiB   int64             `json:"maxRSSKiB"`
	InputHashes map[string]string `json:"inputHashes,omitempty"`
}
type capture struct {
	mu        sync.Mutex
	data      bytes.Buffer
	start     time.Time
	first     int64
	line      []byte
	truncated bool
	cancel    context.CancelFunc
}

func (c *capture) Write(p []byte) (int, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	n := len(p)
	room := outputLimit - c.data.Len()
	if len(p) > room {
		p = p[:room]
		c.truncated = true
		c.cancel()
	}
	c.data.Write(p)
	if c.first == 0 {
		c.line = append(c.line, p...)
		for {
			i := bytes.IndexByte(c.line, '\n')
			if i < 0 {
				break
			}
			if json.Valid(c.line[:i]) {
				c.first = time.Since(c.start).Milliseconds()
				c.line = nil
				break
			}
			c.line = c.line[i+1:]
		}
	}
	return n, nil
}
func execute(in Input, binDir string) Result {
	r := Result{Argv: in.Argv, ExitCode: -1}
	if len(in.Argv) == 0 {
		r.Error = "Missing executable"
		return r
	}
	name := filepath.Base(in.Argv[0])
	allowed := false
	for _, executable := range strings.Split(executableNames, ",") {
		if name == executable {
			allowed = true
		}
	}
	if !allowed || in.Argv[0] != binDirectory+"/"+name {
		r.Error = "Unsupported executable"
		return r
	}
	if in.TimeoutMs < 1 || in.TimeoutMs > 90000 || len(in.Stdin) > 16384 || len(in.Argv) > 100 {
		r.Error = "Invalid execution limits"
		return r
	}
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(in.TimeoutMs)*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, filepath.Join(binDir, name), in.Argv[1:]...)
	cmd.Stdin = strings.NewReader(in.Stdin)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = time.Second
	cmd.Cancel = func() error {
		err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		if err == syscall.ESRCH {
			return os.ErrProcessDone
		}
		return err
	}
	cmd.Env = []string{"PATH=" + binDirectory + ":/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", "HOME=" + runtimeHome, "NO_COLOR=1", "GOMAXPROCS=1", "PYTHONDONTWRITEBYTECODE=1"}
	if name == "hashcat" {
		cmd.Env = append(cmd.Env, "POCL_MAX_PTHREAD_COUNT=2", "POCL_CPU_MAX_CU_COUNT=2")
	}
	if err := os.MkdirAll(runtimeHome, 0700); err != nil {
		r.Error = "Cannot create runtime home"
		return r
	}
	if info, err := os.Lstat(runtimeHome); err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		r.Error = "Unsafe runtime home"
		return r
	}
	if len(in.Files) > 0 {
		if allowFiles != "true" {
			r.Error = "Files are disabled for this pack"
			return r
		}
		total := 0
		r.InputHashes = map[string]string{}
		for name, file := range in.Files {
			if name != "input" && name != "dictionary" {
				r.Error = "Unsupported input file"
				return r
			}
			if len(file.Base64) > 2796204 {
				r.Error = "Input files exceed two MiB"
				return r
			}
			body, err := base64.StdEncoding.DecodeString(file.Base64)
			total += len(body)
			if err != nil || len(body) == 0 || total > 2097152 {
				r.Error = "Invalid or oversized input file"
				return r
			}
			digest := sha256.Sum256(body)
			encoded := hex.EncodeToString(digest[:])
			if encoded != file.SHA256 {
				r.Error = "File checksum mismatch"
				return r
			}
			path := filepath.Join(runtimeHome, name+".bin")
			f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, 0600)
			if err != nil {
				r.Error = "Cannot prepare input file"
				return r
			}
			defer os.Remove(path)
			_, err = f.Write(body)
			closeErr := f.Close()
			if err != nil || closeErr != nil {
				r.Error = "Cannot write input file"
				return r
			}
			r.InputHashes[name] = encoded
		}
	}
	out := &capture{start: start, cancel: cancel}
	stderr := &capture{start: start, cancel: cancel}
	// Own the pipes so Cmd.Wait observes the direct child's exit immediately.
	// This lets us terminate descendants even when they retain stdout/stderr.
	outR, outW, err := os.Pipe()
	if err != nil {
		r.Error = err.Error()
		return r
	}
	defer outR.Close()
	defer outW.Close()
	errR, errW, err := os.Pipe()
	if err != nil {
		r.Error = err.Error()
		return r
	}
	defer errR.Close()
	defer errW.Close()
	cmd.Stdout = outW
	cmd.Stderr = errW
	if err = cmd.Start(); err != nil {
		r.Error = err.Error()
		return r
	}
	outW.Close()
	errW.Close()
	var readers sync.WaitGroup
	readers.Add(2)
	go func() { defer readers.Done(); _, _ = io.Copy(out, outR) }()
	go func() { defer readers.Done(); _, _ = io.Copy(stderr, errR) }()
	err = cmd.Wait()
	// A recon command never owns a persistent background service.
	_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	readers.Wait()
	r.ProcessMs = time.Since(start).Milliseconds()
	r.Stdout = out.data.String()
	r.Stderr = stderr.data.String()
	r.FirstJSONMs = out.first
	r.Truncated = out.truncated || stderr.truncated
	r.TimedOut = ctx.Err() == context.DeadlineExceeded
	if cmd.ProcessState != nil {
		r.ExitCode = cmd.ProcessState.ExitCode()
		r.CPUUserMs = cmd.ProcessState.UserTime().Milliseconds()
		r.CPUSystemMs = cmd.ProcessState.SystemTime().Milliseconds()
		if usage, ok := cmd.ProcessState.SysUsage().(*syscall.Rusage); ok {
			r.MaxRSSKiB = usage.Maxrss
			if runtime.GOOS == "darwin" {
				r.MaxRSSKiB /= 1024
			}
		}
	}
	if err != nil {
		r.Error = err.Error()
	}
	return r
}
func main() {
	if len(os.Args) == 2 && os.Args[1] == "--capabilities" {
		result := map[string]any{"platform": runtime.GOOS, "architecture": runtime.GOARCH, "rawPacketSocket": false}
		if runtime.GOOS == "linux" {
			fd, err := syscall.Socket(17, syscall.SOCK_RAW, 0x0300)
			if err == nil {
				result["rawPacketSocket"] = true
				_ = syscall.Close(fd)
			} else {
				result["rawPacketError"] = err.Error()
			}
		}
		_ = json.NewEncoder(os.Stdout).Encode(result)
		return
	}
	var in Input
	body, err := io.ReadAll(io.LimitReader(os.Stdin, 4194305))
	if err != nil || len(body) > 4194304 {
		fmt.Fprintln(os.Stderr, "Invalid execution request size")
		os.Exit(2)
	}
	d := json.NewDecoder(bytes.NewReader(body))
	d.DisallowUnknownFields()
	if err := d.Decode(&in); err != nil {
		fmt.Fprintln(os.Stderr, "Invalid execution request")
		os.Exit(2)
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		fmt.Fprintln(os.Stderr, "Invalid request trailer")
		os.Exit(2)
	}
	if err := json.NewEncoder(os.Stdout).Encode(execute(in, binDirectory)); err != nil {
		os.Exit(2)
	}
}
