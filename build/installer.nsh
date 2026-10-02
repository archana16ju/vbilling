!macro customInstall
  DetailPrint "Checking Microsoft Visual C++ Redistributable..."
  ClearErrors
  ReadRegDword $R0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  IntCmp $R0 1 installed

  DetailPrint "Visual C++ Redistributable not found. Downloading..."
  inetc::get "https://aka.ms/vs/17/release/vc_redist.x64.exe" "$TEMP\vc_redist.x64.exe" /END
  Pop $R0
  StrCmp $R0 "OK" success failed

  success:
    DetailPrint "Installing Microsoft Visual C++ Redistributable silently..."
    nsExec::ExecToLog '"$TEMP\vc_redist.x64.exe" /install /quiet /norestart'
    Delete "$TEMP\vc_redist.x64.exe"
    Goto installed

  failed:
    DetailPrint "Failed to download Visual C++ Redistributable. The app might not run correctly."
    
  installed:
    DetailPrint "Microsoft Visual C++ Redistributable is installed."
!macroend
