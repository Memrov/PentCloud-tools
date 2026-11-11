package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func fixture(t *testing.T, body string) string {
	t.Helper()
	d := t.TempDir()
	if err := os.WriteFile(filepath.Join(d, "dnsx"), []byte("#!/bin/sh\n"+body), 0755); err != nil {
		t.Fatal(err)
	}
	return d
}
func input(ms int) Input {
	return Input{Argv: []string{"/opt/pentcloud-recon/bin/dnsx"}, TimeoutMs: ms}
}
func TestFailureExitAndStderr(t *testing.T) {
	d := fixture(t, "printf 'diagnostic' >&2\nexit 7\n")
	r := execute(input(1000), d)
	if r.ExitCode != 7 || r.Stderr != "diagnostic" {
		t.Fatalf("wrong result: %+v", r)
	}
}
func TestExtendedExecutionBudgetIsAccepted(t *testing.T) {
	d := fixture(t, "printf 'extended budget accepted'\n")
	r := execute(input(900000), d)
	if r.ExitCode != 0 || r.Stdout != "extended budget accepted" || r.TimedOut {
		t.Fatalf("extended execution budget was rejected: %+v", r)
	}
}
func TestEnvironmentDoesNotInheritSecrets(t *testing.T) {
	t.Setenv("PENTCLOUD_TEST_SECRET", "must-not-be-inherited")
	d := fixture(t, "printf '%s' \"${PENTCLOUD_TEST_SECRET-unset}\"\n")
	r := execute(input(1000), d)
	if r.Stdout != "unset" {
		t.Fatalf("environment was inherited: %+v", r)
	}
}
func TestDeadlineKillsDescendants(t *testing.T) {
	marker := filepath.Join(t.TempDir(), "leaked")
	d := fixture(t, "(sleep 0.3; echo leaked > '"+marker+"') &\nsleep 5\n")
	start := time.Now()
	r := execute(input(50), d)
	if !r.TimedOut || time.Since(start) > 2*time.Second {
		t.Fatalf("deadline not enforced: %+v", r)
	}
	time.Sleep(400 * time.Millisecond)
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("descendant survived the deadline")
	}
}
func TestOutputIsBounded(t *testing.T) {
	for _, suffix := range []string{"", " >&2"} {
		d := fixture(t, "head -c 3000000 /dev/zero"+suffix+"\n")
		r := execute(input(2000), d)
		if !r.Truncated || len(r.Stdout) > 2097152 || len(r.Stderr) > 2097152 {
			t.Fatalf("output unbounded: lengths %d/%d truncated %v", len(r.Stdout), len(r.Stderr), r.Truncated)
		}
	}
}
func TestRejectsOtherExecutables(t *testing.T) {
	r := execute(Input{Argv: []string{"/bin/sh", "-c", "echo unexpected"}, TimeoutMs: 1000}, t.TempDir())
	if r.ExitCode == 0 || !strings.Contains(r.Error, "executable") {
		t.Fatalf("executable was accepted: %+v", r)
	}
}

func TestParentExitKillsDescendants(t *testing.T) {
	marker := filepath.Join(t.TempDir(), "leaked")
	d := fixture(t, "(sleep 0.2; echo leaked > '"+marker+"') &\nexit 0\n")
	r := execute(input(5000), d)
	time.Sleep(300 * time.Millisecond)
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatal("descendant survived the parent exit")
	}
	if r.ExitCode != 0 || r.Error != "" {
		t.Fatalf("parent completion was delayed by inherited pipes: %+v", r)
	}
}

func TestExecutionLimitsRejectBeforeStarting(t *testing.T) {
	d := fixture(t, "printf 'started'\n")
	if valid := execute(input(1000), d); valid.ExitCode != 0 || valid.Stdout != "started" {
		t.Fatalf("fixture cannot run: %+v", valid)
	}
	tooManyArgs := append(input(1000).Argv, make([]string, 100)...)
	for _, tc := range []struct {
		in   Input
		want string
	}{
		{Input{}, "Missing executable"},
		{input(0), "Invalid execution limits"},
		{input(900001), "Invalid execution limits"},
		{Input{Argv: input(1000).Argv, TimeoutMs: 1000, Stdin: strings.Repeat("x", 16385)}, "Invalid execution limits"},
		{Input{Argv: tooManyArgs, TimeoutMs: 1000}, "Invalid execution limits"},
	} {
		r := execute(tc.in, d)
		if r.ExitCode != -1 || r.Error != tc.want || r.Stdout != "" {
			t.Fatalf("invalid request was accepted: %+v", r)
		}
	}
}
func TestFirstJSONRecordCanSpanChunks(t *testing.T) {
	c := &capture{start: time.Now().Add(-time.Millisecond), cancel: func() {}}
	_, _ = c.Write([]byte("diagnostic\n{\"value\":"))
	if c.first != 0 {
		t.Fatal("partial JSON counted as a record")
	}
	_, _ = c.Write([]byte("1}\n"))
	if c.first == 0 || c.data.String() != "diagnostic\n{\"value\":1}\n" {
		t.Fatal("split JSON was dropped or rewritten")
	}
}
func TestProtocolHelperProcess(t *testing.T) {
	if os.Getenv("PENTCLOUD_PROTOCOL_HELPER") != "1" {
		return
	}
	main()
	os.Exit(0)
}
func protocol(t *testing.T, body string) (int, []byte, []byte) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, os.Args[0], "-test.run=^TestProtocolHelperProcess$")
	cmd.Env = append(os.Environ(), "PENTCLOUD_PROTOCOL_HELPER=1")
	cmd.Stdin = strings.NewReader(body)
	var out, stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	err := cmd.Run()
	code := 0
	if err != nil {
		code = cmd.ProcessState.ExitCode()
	}
	return code, out.Bytes(), stderr.Bytes()
}
func TestProtocolRejectsMalformedUnknownAndTrailingInput(t *testing.T) {
	for _, body := range []string{"not json", `{"unknown":true}`, `{} {}`} {
		code, out, stderr := protocol(t, body)
		if code != 2 || len(out) != 0 || !strings.Contains(string(stderr), "Invalid") {
			t.Fatalf("invalid protocol accepted: %d %s %s", code, out, stderr)
		}
	}
}
func TestProtocolReturnsStructuredExecutionFailure(t *testing.T) {
	code, out, _ := protocol(t, `{"argv":["/bin/sh"],"stdin":"","timeoutMs":1000}`)
	var result Result
	if code != 0 || json.Unmarshal(out, &result) != nil || result.ExitCode != -1 || result.Error != "Unsupported executable" {
		t.Fatalf("wrong protocol response: %d %s", code, out)
	}
}

func TestPackBuildConfigurationRejectsOtherPackExecutables(t *testing.T) {
	old := executableNames
	executableNames = "curl,openssl,ffuf"
	t.Cleanup(func() { executableNames = old })
	r := execute(input(1000), fixture(t, "echo should-not-run\n"))
	if r.Error != "Unsupported executable" || r.Stdout != "" {
		t.Fatalf("another pack's executable was accepted: %+v", r)
	}
}

func TestFileInputRequiresOptInAndVerifiedDigest(t *testing.T) {
	oldHome, oldFiles := runtimeHome, allowFiles
	runtimeHome, allowFiles = t.TempDir(), "true"
	t.Cleanup(func() { runtimeHome, allowFiles = oldHome, oldFiles })
	d := fixture(t, "cat \"$HOME/input.bin\"\n")
	in := input(1000)
	in.Files = map[string]FileInput{"input": {Base64: "Zml4dHVyZQ==", SHA256: "f16d05ec6b29248d2c61ad6ddc143d61d4c30f9e06f0fbdd3d9e31f765a4a088"}}
	// A wrong digest must never start a process or leave an input behind.
	r := execute(in, d)
	if r.Error != "File checksum mismatch" || r.Stdout != "" {
		t.Fatalf("bad digest accepted: %+v", r)
	}
	in.Files["input"] = FileInput{Base64: "Zml4dHVyZQ==", SHA256: "f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d"}
	r = execute(in, d)
	if r.ExitCode != 0 || r.Stdout != "fixture" {
		t.Fatalf("verified bytes not delivered: %+v", r)
	}
	if _, err := os.Stat(filepath.Join(runtimeHome, "input.bin")); !os.IsNotExist(err) {
		t.Fatal("input file survived execution")
	}
	allowFiles = "false"
	if r = execute(in, d); r.Error != "Files are disabled for this pack" {
		t.Fatalf("files accepted without opt-in: %+v", r)
	}
	allowFiles = "true"
	delete(in.Files, "input")
	in.Files["../escape"] = FileInput{Base64: "Zg==", SHA256: "x"}
	if r = execute(in, d); r.Error != "Unsupported input file" {
		t.Fatalf("file path was accepted: %+v", r)
	}
}

func TestProtocolRejectsOversizedTrailerBeforeExecuting(t *testing.T) {
	code, out, _ := protocol(t, `{"argv":["/bin/sh"],"timeoutMs":1000}`+strings.Repeat(" ", 4194304)+`{}`)
	if code != 2 || len(out) != 0 {
		t.Fatalf("oversized input accepted: %d", code)
	}
}
