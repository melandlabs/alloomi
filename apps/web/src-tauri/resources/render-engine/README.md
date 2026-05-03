# Render Engine

This directory contains the bundled LibreOffice and poppler binaries for high-fidelity PPTX preview rendering.

## Directory Structure

```
render-engine/
├── darwin-arm64/     # macOS ARM64 (Apple Silicon)
├── darwin-x64/       # macOS x86_64 (Intel)
├── linux-x64/        # Linux x86_64
└── windows-x64/      # Windows x86_64
```

## Required Binaries

For each platform, place the following binaries:

### macOS (darwin-arm64, darwin-x64)

1. **LibreOffice.app** - Download from https://www.libreoffice.org/download/download/
   - Extract the downloaded `.dmg` file
   - Copy `LibreOffice.app` to `darwin-arm64/` or `darwin-x64/`

2. **poppler** (for pdftoppm) - Install via Homebrew:

   ```bash
   brew install poppler
   ```

   - The `pdftoppm` binary will be in `/usr/local/bin/` or `/opt/homebrew/bin/`
   - Copy `pdftoppm` to the platform directory

### Linux (linux-x64)

1. **LibreOffice** - Download from https://www.libreoffice.org/download/download/
   - Extract and use the `program/soffice` binary

2. **poppler** - Install via package manager:
   ```bash
   sudo apt install poppler-utils  # Debian/Ubuntu
   sudo yum install poppler-utils   # RHEL/CentOS
   ```

### Windows (windows-x64)

1. **LibreOffice** - Download from https://www.libreoffice.org/download/download/
   - Use the `program/soffice.exe` binary

2. **poppler** - Download from https://github.com/oschwartz10612/poppler-windows/releases
   - Place `pdftoppm.exe` in the platform directory

## Verification

After placing the binaries, the render engine status can be checked via the desktop app's developer tools or logs. The app will automatically detect and use the bundled binaries when available.

## Notes

- The binaries are optional - the app will fall back to client-side PPTX rendering if the bundled engines are not available
- Ensure the binaries are executable (chmod +x on Unix systems)
- The `soffice` binary path should be: `{platform_dir}/soffice` (symlinks are OK)
- The `pdftoppm` binary path should be: `{platform_dir}/pdftoppm`
