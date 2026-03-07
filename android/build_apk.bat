@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Starting Build with JAVA_HOME: %JAVA_HOME%
call gradlew.bat assembleDebug
