import io
import os.path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload


class DriveService:
    SCOPES: tuple[str, ...] = ("https://www.googleapis.com/auth/drive",)

    def __init__(self, credentials_path="credentials.json", token_path="token.json"):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.service = self._authenticate()

    def _authenticate(self):
        """Interne Methode zur Authentifizierung."""
        creds = None
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, self.SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(self.credentials_path, self.SCOPES)
                creds = flow.run_local_server(port=0)
            with open(self.token_path, "w") as token:
                token.write(creds.to_json())

        return build("drive", "v3", credentials=creds)

    # --- ORDNER-MANAGEMENT ---

    def get_or_create_folder(self, name, parent_id):
        """Prüft ob Ordner existiert, sonst wird er erstellt."""
        query = f"name = '{name}' and '{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        results = self.service.files().list(q=query, fields="files(id)").execute()
        items = results.get("files", [])

        if items:
            return items[0]["id"]
        else:
            return self.create_folder(name, parent_id)

    def create_folder(self, name, parent_id=None):
        try:
            file_metadata = {"name": name, "mimeType": "application/vnd.google-apps.folder"}
            if parent_id:
                file_metadata["parents"] = [parent_id]
            file = self.service.files().create(body=file_metadata, fields="id").execute()
            return file.get("id")
        except HttpError as error:
            print(f"Fehler beim Erstellen des Ordners: {error}")
            return None

    def list_folder_structure(self, parent_id, indent=""):
        try:
            query = f"'{parent_id}' in parents and trashed = false"
            results = (
                self.service.files().list(q=query, fields="files(id, name, mimeType)").execute()
            )
            items = results.get("files", [])
            for item in items:
                is_folder = item["mimeType"] == "application/vnd.google-apps.folder"
                icon = "📁" if is_folder else "📄"
                print(f"{indent}{icon} {item['name']} (ID: {item['id']})")
                if is_folder:
                    self.list_folder_structure(item["id"], indent + "   ")
        except HttpError as error:
            print(f"Fehler: {error}")

    # --- UPLOAD METHODEN ---

    def upload_file(self, local_path, parent_id):
        """Lädt eine einzelne Datei hoch."""
        try:
            file_metadata = {"name": os.path.basename(local_path), "parents": [parent_id]}
            media = MediaFileUpload(local_path, resumable=True)
            file = (
                self.service.files()
                .create(body=file_metadata, media_body=media, fields="id")
                .execute()
            )
            print(f"✅ Upload abgeschlossen: {os.path.basename(local_path)}")
            return file.get("id")
        except Exception as e:
            print(f"❌ Fehler beim Upload von {local_path}: {e}")

    def upload_folder(self, local_folder_path, drive_parent_id):
        """Lädt einen kompletten lokalen Ordner hoch."""
        print(f"🚀 Starte Batch-Upload von: {local_folder_path}")
        for filename in os.listdir(local_folder_path):
            file_path = os.path.join(local_folder_path, filename)
            if os.path.isfile(file_path):
                self.upload_file(file_path, drive_parent_id)

    # --- DOWNLOAD METHODEN ---

    def download_file(self, file_id, file_name, local_dest_folder):
        """Lädt eine einzelne Datei (Video/Bild) herunter."""
        try:
            request = self.service.files().get_media(fileId=file_id)
            os.makedirs(local_dest_folder, exist_ok=True)
            local_path = os.path.join(local_dest_folder, file_name)

            fh = io.FileIO(local_path, "wb")
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            print(f"✅ Download abgeschlossen: {file_name}")
        except Exception as e:
            print(f"❌ Fehler beim Download von {file_name}: {e}")

    def download_folder(self, drive_folder_id, local_dest_path):
        """Lädt alle Dateien aus einem Drive-Ordner herunter."""
        results = (
            self.service.files()
            .list(
                q=f"'{drive_folder_id}' in parents and trashed = false",
                fields="files(id, name, mimeType)",
            )
            .execute()
        )
        items = results.get("files", [])

        for item in items:
            if item["mimeType"] == "application/vnd.google-apps.folder":
                # Unterordner lokal erstellen und rekursiv laden
                new_local_path = os.path.join(local_dest_path, item["name"])
                self.download_folder(item["id"], new_local_path)
            else:
                self.download_file(item["id"], item["name"], local_dest_path)
