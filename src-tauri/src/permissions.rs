use std::process::Command;
use std::path::Path;
use std::fs;

/// Check if BPF devices are readable by the current user
pub fn check_bpf_access() -> bool {
    Path::new("/dev/bpf0").exists() && {
        // Try to open /dev/bpf0 for reading
        match fs::File::open("/dev/bpf0") {
            Ok(_) => true,
            Err(_) => false,
        }
    }
}

/// Request BPF access via native macOS authorization dialog.
/// Installs a LaunchDaemon that persists across reboots.
pub fn request_bpf_access() -> Result<(), String> {
    let script = r#"
        -- Create access_bpf group if it doesn't exist
        do shell script "
            /usr/sbin/dseditgroup -o read access_bpf 2>/dev/null || /usr/sbin/dseditgroup -o create access_bpf
            /usr/sbin/dseditgroup -o edit -a $USER -t user access_bpf

            # Create ChmodBPF script
            mkdir -p '/Library/Application Support/SNIFFF'
            cat > '/Library/Application Support/SNIFFF/ChmodBPF' << 'SCRIPT'
#!/bin/bash
chgrp access_bpf /dev/bpf*
chmod g+r /dev/bpf*
SCRIPT
            chmod 755 '/Library/Application Support/SNIFFF/ChmodBPF'

            # Create LaunchDaemon plist
            cat > /Library/LaunchDaemons/com.snifff.chmodbpf.plist << 'PLIST'
<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
    <key>Label</key>
    <string>com.snifff.chmodbpf</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Library/Application Support/SNIFFF/ChmodBPF</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLIST

            # Load and run now
            launchctl load /Library/LaunchDaemons/com.snifff.chmodbpf.plist 2>/dev/null || true
            /Library/Application\\ Support/SNIFFF/ChmodBPF
        " with administrator privileges
    "#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Authorization failed: {}", stderr))
    }
}

/// Ensure BPF access — check first, request if needed
pub fn ensure_bpf_access() -> Result<bool, String> {
    if check_bpf_access() {
        log::info!("BPF access already available");
        return Ok(true);
    }

    log::info!("BPF access not available, requesting authorization...");
    request_bpf_access()?;

    // Verify access after setup
    if check_bpf_access() {
        log::info!("BPF access granted successfully");
        Ok(true)
    } else {
        // Might need a logout/login for group membership to take effect
        Ok(false)
    }
}
