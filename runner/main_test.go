package main

import (
	"os"
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
