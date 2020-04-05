# Soundboard-backend

> Real-Time Soundboard

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

⚠️ Files must be compressed as much as possible.

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

## Development

### Setup

Rename all files calles `.env.dist` to `.env`

**Install dependencies**

```bash
npm install
```

**Start a local server**

```bash
npm start
```
