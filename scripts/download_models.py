"""
Download models from Google Drive and save them to configured locations.
Uses drive_service.py to handle Google Drive API authentication and download.
Uses model_config.py to define where models should be saved.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from drive_service import DriveService
from model_config import MODEL_PATHS, ensure_model_dirs


class ModelDownloader:
    """Download models from Google Drive and save to configured locations."""

    def __init__(
        self,
        credentials_path: str = "credentials.json",
        token_path: str = "token.json",
    ):
        """Initialize with Google Drive service.

        Args:
            credentials_path: Path to Google OAuth credentials JSON file
            token_path: Path to store authentication token
        """
        self.drive_service = DriveService(credentials_path=credentials_path, token_path=token_path)

    def download_from_folder(self, folder_id: str, overwrite: bool = False):
        """Download all files from a Google Drive folder and map to models.

        Args:
            folder_id: Google Drive folder ID
            overwrite: If True, overwrite existing files

        Returns:
            bool: True if all downloads successful, False if any failed
        """
        print(f"📂 Fetching files from Google Drive folder (ID: {folder_id})...\n")

        try:
            # Get all files in the folder
            results = (
                self.drive_service.service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    fields="files(id, name, mimeType)",
                    pageSize=100,
                )
                .execute()
            )
            items = results.get("files", [])

            if not items:
                print(f"❌ No files found in folder {folder_id}")
                return False

            print(f"✅ Found {len(items)} file(s) in folder")

            # Download first file found (assuming one model per folder)
            if items:
                file_info = items[0]
                print(f"  📥 Downloading: {file_info['name']} (ID: {file_info['id']})")
                return file_info["id"]

        except Exception as e:
            print(f"❌ Error fetching folder contents: {e}")
            return None

    def download_model_from_folder(
        self, model_key: str, folder_id: str, overwrite: bool = False
    ) -> bool:
        """Download a single model file from a Google Drive folder.

        Args:
            model_key: Key from MODEL_PATHS (e.g., 'court_detection')
            folder_id: Google Drive folder ID containing the model file
            overwrite: If True, overwrite existing file

        Returns:
            bool: True if download successful, False otherwise
        """
        if model_key not in MODEL_PATHS:
            print(f"❌ Model key '{model_key}' not found in MODEL_PATHS")
            return False

        print(f"📂 Fetching {MODEL_PATHS[model_key]['name']} from folder {folder_id}...")

        try:
            # Get first file from the folder
            results = (
                self.drive_service.service.files()
                .list(
                    q=f"'{folder_id}' in parents and trashed = false",
                    fields="files(id, name)",
                    pageSize=1,
                )
                .execute()
            )
            items = results.get("files", [])

            if not items:
                print(f"❌ No files found in folder {folder_id}")
                return False

            file_id = items[0]["id"]
            file_name = items[0]["name"]

            print(f"  ✓ Found: {file_name}")

            # Download the file
            return self.download_model(
                model_key=model_key,
                drive_file_id=file_id,
                overwrite=overwrite,
            )

        except Exception as e:
            print(f"❌ Error: {e}")
            return False

    def download_model(self, model_key: str, drive_file_id: str, overwrite: bool = False) -> bool:
        """Download a single model from Google Drive.

        Args:
            model_key: Key from MODEL_PATHS (e.g., 'court_detection')
            drive_file_id: Google Drive file ID
            overwrite: If True, overwrite existing file; if False, skip if exists

        Returns:
            bool: True if download successful, False otherwise
        """
        if model_key not in MODEL_PATHS:
            print(f"❌ Model key '{model_key}' not found in MODEL_PATHS")
            return False

        model_config = MODEL_PATHS[model_key]
        save_path = Path(model_config["save_path"])

        # Check if file already exists
        if save_path.exists() and not overwrite:
            print(f"⏭️  Skipping {model_config['name']} - already exists at {save_path}")
            return True

        print(f"📥 Downloading {model_config['name']} from Google Drive (ID: {drive_file_id})...")

        try:
            # Ensure directory exists
            save_path.parent.mkdir(parents=True, exist_ok=True)

            # Download from Google Drive
            self.drive_service.download_file(
                file_id=drive_file_id,
                file_name=save_path.name,
                local_dest_folder=str(save_path.parent),
            )

            print(f"✅ Successfully saved to: {save_path}")
            return True

        except Exception as e:
            print(f"❌ Error downloading {model_key}: {e}")
            return False

    def download_all_models(
        self,
        drive_file_ids: dict[str, str],
        overwrite: bool = False,
    ) -> bool:
        """Download all models from Google Drive.

        Args:
            drive_file_ids: Dict mapping model_key to Google Drive file ID
                           Example: {
                               'court_detection': 'abc123...',
                               'ball_detection': 'def456...',
                               'player_detection': 'ghi789...',
                           }
            overwrite: If True, overwrite existing files

        Returns:
            bool: True if all downloads successful, False if any failed
        """
        print("🚀 Starting model download from Google Drive...\n")

        # Ensure all directories exist
        ensure_model_dirs()

        results = {}
        for model_key, drive_file_id in drive_file_ids.items():
            success = self.download_model(
                model_key=model_key, drive_file_id=drive_file_id, overwrite=overwrite
            )
            results[model_key] = success

        # Print summary
        print("\n" + "=" * 60)
        print("Download Summary:")
        print("=" * 60)
        for model_key, success in results.items():
            status = "✅ SUCCESS" if success else "❌ FAILED"
            model_name = MODEL_PATHS[model_key]["name"]
            print(f"{status}: {model_name}")

        all_successful = all(results.values())
        print("=" * 60)

        if all_successful:
            print("✅ All models downloaded successfully!")
        else:
            print("⚠️  Some models failed to download. Check errors above.")

        return all_successful


def main():
    """Main entry point for model download.

    Provide a mapping of model_key -> Google Drive FOLDER ID (each model has its own folder).
    The script will take the first file found in each folder and download it to the
    configured local path for the corresponding model.
    """
    # Replace these with your actual Google Drive folder IDs (one folder per model)
    model_folder_ids = {
        "court_detection": "1CwLiXa2giQdRKC5Z0vR7TgaYUfckgxF5",
        "ball_detection": "1-a4mVanJs-B7ANjrdXiHNmaun4M2z1GO",
        "player_detection": "19khgz2aQ-dt_4oPkv61VdndsjF3hbP4G",
    }

    # Create downloader instance
    downloader = ModelDownloader(credentials_path="credentials.json", token_path="token.json")

    # Ensure model directories exist
    ensure_model_dirs()

    # Download each model from its folder
    results: dict[str, bool] = {}
    for model_key, folder_id in model_folder_ids.items():
        print(f"\n--- Processing model: {model_key} ---")
        if not folder_id or folder_id.startswith("YOUR_"):
            print(
                f"❗ Skipping {model_key}: no folder ID configured (set model_folder_ids in the script)."
            )
            results[model_key] = False
            continue

        success = downloader.download_model_from_folder(
            model_key=model_key, folder_id=folder_id, overwrite=False
        )
        results[model_key] = bool(success)

    # Summary
    print("\n" + "=" * 60)
    print("Overall Download Summary:")
    for model_key, ok in results.items():
        status = "✅ SUCCESS" if ok else "❌ FAILED"
        print(f"{status}: {model_key} -> {MODEL_PATHS[model_key]['save_path']}")

    all_ok = all(results.values())
    print("=" * 60)
    return 0 if all_ok else 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
