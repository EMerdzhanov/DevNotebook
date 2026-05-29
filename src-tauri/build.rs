fn main() {
    tauri_build::build();

    // Compile Swift Bluetooth helper on macOS
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let out_dir = std::env::var("OUT_DIR").unwrap();
        let helper_path = format!("{}/bt_proximity", out_dir);
        let status = Command::new("swiftc")
            .args([
                "helpers/bt_proximity.swift",
                "-o",
                &helper_path,
                "-framework",
                "IOBluetooth",
                "-O",
            ])
            .status()
            .expect("Failed to compile bt_proximity.swift — is Xcode installed?");
        assert!(status.success(), "Swift compilation failed");
        println!("cargo:rerun-if-changed=helpers/bt_proximity.swift");
    }
}
