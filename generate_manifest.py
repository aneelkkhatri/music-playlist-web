import os
import json

# Scan playlists directory for all .json files
playlist_dir = 'playlists'
manifest = []
for fname in os.listdir(playlist_dir):
    if fname.endswith('.json'):
        path = os.path.join(playlist_dir, fname)
        with open(path) as f:
            try:
                data = json.load(f)
                manifest.append({
                    'id': data.get('id', fname[:-5]),
                    'title': data.get('title', fname[:-5]),
                    'thumbnails': [entry.get('thumbnails', [])[0] if entry.get('thumbnails') else None for entry in data.get('entries', [])[:4]],
                    'channel': data.get('channel', ''),
                    'channel_id': data.get('channel_id', '')
                })
            except Exception as e:
                print(f"Failed to load {fname}, skipping. Error: {e}")
                continue
with open('playlists.json', 'w') as f:
    json.dump(manifest, f, indent=2)
