- GitHub: https://github.com/gilad-bendor/subtitle-translator
- Go to [subdl.com](https://subdl.com/subtitle/sd1300281/frasier)
   and download something like `Frasier.S04.1080p.BluRay.Remux.DTS-HD.MA2.0.H.264-BTN`
- Copy srt files to [src](src) folder
- Run `npm install && node index.js`
- Translated srt files at [res](res) folder




<img width="762" alt="image" src="https://user-images.githubusercontent.com/16719720/222925676-227fd7a3-da34-4dd8-be34-7e5664a4e56b.png">

# subtitle-translator
Translate subtitle using ChatGPT
## Features
- Translate subtitle using ChatGPT `gpt-3.5-turbo`
- Support multiple languages
- Translation according to the preceding and following sentences
## How to use
- Electron
  - You can download the electron app from [here](https://github.com/gnehs/subtitle-translator-electron/releases)
- Node.js
  - Get your own API key from [here](https://platform.openai.com/account/api-keys)
  - Rename `config.example.json` to `config.json` and fill in your API key and target language.
  - Put your subtitle file in `src` folder
  - Run `npm install` to install dependencies
  - Run `node index.js` to start
  - After the translation is done, you can find the translated file in `res` folder

## Supported subtitle extensions
- `.srt`
- `.vtt` WebVTT

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.