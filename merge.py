import json
import os

# Folder where all your JSON files are stored
folder_path = "./data/plans/book14"  # change this to your actual folder path

merged_data = {}

for filename in os.listdir(folder_path):
    if filename.endswith(".json"):
        file_path = os.path.join(folder_path, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                # If each file is a dict, merge keys
                if isinstance(data, dict):
                    merged_data.update(data)
                # If each file is a list, append items
                elif isinstance(data, list):
                    merged_data.setdefault("merged_list", []).extend(data)
            except json.JSONDecodeError as e:
                print(f"Skipping {filename}, invalid JSON: {e}")

# Save merged output
with open("merged_output.json", "w", encoding="utf-8") as out_file:
    json.dump(merged_data, out_file, indent=2)

print("✅ Merged all JSON files into merged_output.json")
