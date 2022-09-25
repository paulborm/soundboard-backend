# Soundboard-backend

> ⚠️ Moved to https://github.com/paulborm/soundboard

## Media files

**Directory structure**

```
+-- public
|   +-- images
|       +-- *.jpg
|   +-- sounds
|       +-- *.mp3
```

### Compression

Files must be compressed as much as possible.

**Audio files**

Use a tool like [ffmpeg](https://ffmpeg.org/)

Installation on macOS:

```bash
brew install ffmpeg
```

```bash
ffmpeg -i input_file.mp3 -ab 48k  output_file.mp3
```

-ab: Bitrate (something between 32k, - 64k)

**Image files**

Use a tool like [ImageOptim](https://imageoptim.com/mac) with the highes possible compression.
