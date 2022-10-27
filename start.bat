start cmd.exe /c wer.bat
cd server
uvicorn main:app --reload --host 