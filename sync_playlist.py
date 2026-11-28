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

def fetch_music_tracks(playlist_id):
    """Tracks with artists, album and duration, from YouTube Music.

    One request per playlist. Returns [] if YouTube Music is unavailable, so the
    sync still works without the extra metadata.
    """
    try:
        from ytmusicapi import YTMusic
        tracks = YTMusic().get_playlist(playlist_id, limit=None).get('tracks', [])
    except Exception as e:
        print(f"Warning: no YouTube Music metadata for {playlist_id}: {e}")
        return []

    return [{
        'video_id': track.get('videoId'),
        'title': track.get('title') or '',
        'artists': [a['name'] for a in (track.get('artists') or []) if a.get('name')],
        'album': (track.get('album') or {}).get('name'),
        'duration': track.get('duration_seconds'),
    } for track in tracks]

def titles_match(a, b):
    a, b = (a or '').casefold().strip(), (b or '').casefold().strip()
    return bool(a and b) and (a == b or a.startswith(b) or b.startswith(a))

def match_music_metadata(entries, tracks):
    """Map each yt-dlp entry index to its YouTube Music track.

    YouTube Music sometimes swaps a music video for its audio-only counterpart,
    which has a different video id. Those are matched by position instead, but
    only when both lists have the same length and the titles agree.
    """
    by_id = {t['video_id']: t for t in tracks if t['video_id']}
    same_order = len(tracks) == len(entries)
    matched = {}
    for i, entry in enumerate(entries):
        track = by_id.get(entry.get('id'))
        if track is None and same_order and titles_match(entry.get('title'), tracks[i]['title']):
            track = tracks[i]
        if track is not None:
            matched[i] = track
    return matched

def load_previous_entries(filename):
    """Entries from the last sync, used to keep metadata if YouTube Music fails."""
    try:
        with open(filename) as f:
            return {e.get('id'): e for e in json.load(f).get('entries', [])}
    except (OSError, ValueError):
        return {}

def save_playlist(playlist, playlist_id, music_tracks):
    keys_to_pop = ['epoch', '_version', '__files_to_move']
    for key in keys_to_pop:
        playlist.pop(key, None)

    os.makedirs('playlists', exist_ok=True)
    filename = f'playlists/{playlist_id}.json'
    previous = load_previous_entries(filename)

    # Filter each entry to only keep required fields, plus music metadata
    entries = playlist.get('entries', [])
    music_by_index = match_music_metadata(entries, music_tracks)
    for i, entry in enumerate(entries):
        video_id = entry.get('id')
        music = music_by_index.get(i) or previous.get(video_id) or {}
        entries[i] = {
            'id': video_id,
            'title': entry.get('title'),
            'channel': entry.get('channel'),
            'channel_id': entry.get('channel_id'),
            'thumbnails': entry.get('thumbnails'),
            'artists': music.get('artists') or [],
            'album': music.get('album'),
            'duration': music.get('duration') or entry.get('duration'),
        }
    with open(filename, 'w') as f:
        json.dump(playlist, f, indent=2)
    return entries

if __name__ == '__main__':
    try:
        playlist_id = get_playlist_id()
        playlist = fetch_playlist(playlist_id)
        music_tracks = fetch_music_tracks(playlist_id)
        entries = save_playlist(playlist, playlist_id, music_tracks)
        with_artists = sum(1 for e in entries if e['artists'])
        print(f"Saved {len(entries)} videos to {playlist_id}.json "
              f"({with_artists} with artist metadata)")
    except Exception as e:
        print(f"An error occurred while syncing the playlist: {e}")
        sys.exit(0)
