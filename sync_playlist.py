import json
import os
import subprocess
import sys

def get_playlist_id():
    if len(sys.argv) < 2:
        print("Usage: python sync_playlist.py <playlist_id>")
        sys.exit(1)
    return sys.argv[1]

def fetch_playlist(playlist_id):
    # Use yt-dlp to extract playlist info as JSON
    playlist_url = f'https://www.youtube.com/playlist?list={playlist_id}'
    result = subprocess.run([
        'yt-dlp',
        '--flat-playlist',
        '-J',
        playlist_url
    ], capture_output=True, text=True)
    playlist = json.loads(result.stdout)
    return playlist

def save_playlist(playlist, playlist_id):
    keys_to_pop = ['epoch', '_version', '__files_to_move']
    for key in keys_to_pop:
        playlist.pop(key, None) 

    # Filter each entry to only keep required fields
    entries = playlist.get('entries', [])
    allowed_keys = {'id', 'title', 'channel', 'channel_id', 'thumbnails'}
    for i, entry in enumerate(entries):
        entries[i] = {
            'id': entry.get('id'),
            'title': entry.get('title'),
            'channel': entry.get('channel'),
            'channel_id': entry.get('channel_id'),
            'thumbnails': entry.get('thumbnails')
        }
    os.makedirs('playlists', exist_ok=True)
    filename = f'playlists/{playlist_id}.json'
    with open(filename, 'w') as f:
        json.dump(playlist, f, indent=2)

if __name__ == '__main__':
    try:
        playlist_id = get_playlist_id()
        playlist = fetch_playlist(playlist_id)
        save_playlist(playlist, playlist_id)
        print(f"Saved {len(playlist.get('entries', []))} videos to {playlist_id}.json")
    except Exception as e:
        print(f"An error occurred while syncing the playlist: {e}")
        sys.exit(0)
