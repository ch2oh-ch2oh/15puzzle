start cmd.exe /c wer.bat
cd server
uvicorn main:app --reload --host 192.168.0.10 --port 50000