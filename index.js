import fs from 'fs'
import colors from 'colors'
import { Configuration, OpenAIApi } from 'openai'
import { parseSync, stringifySync } from 'subtitle'
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'))

const MIN_LENGTH_TO_CHECK = 5;
const MAX_BAD_CHARS_RATIO = 0.2;
const MAX_REQUEST_RETRIES = 5;

const configuration = new Configuration({
  apiKey: config.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

let subtitles = fs.readdirSync('./src')
let supportExtensions = ['srt', 'vtt']
for (let subtitleFile of subtitles) {
  if (!supportExtensions.includes(subtitleFile.split('.').pop())) {
    console.log(`Skipping non-subtitle ${subtitleFile}`.gray);
    continue
  }
  if (fs.statSync(`./res/${subtitleFile}`, { throwIfNoEntry: false })) {
    console.log(`Skipping already translated ${subtitleFile}`.gray);
    continue;
  }

  console.log(`\n\n==============================     ${subtitleFile}     ==============================\n`);
  let subtitle = fs.readFileSync(`./src/${subtitleFile}`, 'utf8')
  subtitle = parseSync(subtitle)
  subtitle = subtitle.filter(line => line.type === 'cue')

  let previousSubtitles = []

  // Loop over all subtitles.
  subtitlesLoop:
  for (let i = 0; i < subtitle.length; i++) {
    let text = subtitle[i].data.text
    let input = { Input: text }
    if (subtitle[i + 1]) {
      input.Next = subtitle[i + 1].data.text
    }
    let temperature = 0;

    // Call GPT for a single subtitle - with retries for non-hebrew translations.
    let request;
    let result;
    let firstResult;
    for (let retry; ; retry++) {
      // Call GPT for a single subtitle - with retries for GPT errors.
      let completion = undefined;
      for (;;) {
        request = {
          model: "gpt-3.5-turbo",
          temperature,
          messages: [
            {
              role: "system",
              content: `
                    You are a program responsible for translating subtitles.
                    Your task is to output the specified target language based on the input text.
                    Please do not create the following subtitles on your own.
                    Please do not output any text other than the translation.
                    You will receive the subtitles as array that needs to be translated,
                     as well as the previous translation results and next subtitle.
                    If you need to merge the subtitles with the following line, simply repeat the translation.
                    Please transliterate the person's name into the local language.
                    Target language: ${config.TARGET_LANGUAGE}.
                    Never output anything other that is not ${config.TARGET_LANGUAGE}.
                  `.replace(/\s+/g, ' ').trim()
            },
            ...previousSubtitles.slice(-4),
            {
              role: "user",
              content: JSON.stringify(input)
            }
          ],
        };
        try {
          completion = await openai.createChatCompletion(request, {timeout: 60 * 1000});
          break;
        } catch (e) {
          console.error('Request: '.red, request);
          console.error('Error: '.red, e);

          if (retry < MAX_REQUEST_RETRIES) {
            console.log('Retrying...'.red);
          } else {
            console.error(`Giving up after ${MAX_REQUEST_RETRIES} retries`.red);
            subtitle[i].data.text = `(בלתי ניתן לתרגום)\n(can't be translated)`

            continue subtitlesLoop;
          }
        }
      }

      result = completion.data.choices[0].message.content
      try {
        result = JSON.parse(result).Input
      } catch (e) {
        try {
          if (i > 0) {
            console.warn(`Warning: not a JSON:    ${result}`.yellow);
          }
          result = result.match(/"Input":"(.*?)"/)[1]
        } catch (e) {
          if (i === 0) {
            // First subtitle - no K-shots, the result is the full translation.
          } else {
            // Strange, response is not in the right format.
            console.log('###'.red)
            console.log(e.toString().red)
            console.log(result.red)
            console.log('###'.red)
          }
        }
      }

      // Make sure the translation is hebrew.
      const badCharsRegExp = /[a-zA-Z]/g;
      const resultWithoutTags = result.replace(/<[^>]*>/g, '');
      const badCharsCount = resultWithoutTags.length - resultWithoutTags.replace(badCharsRegExp, '').length;
      const badCharsRatio = badCharsCount / resultWithoutTags.length;
      if ((resultWithoutTags.length < MIN_LENGTH_TO_CHECK) ||
          (badCharsRatio < MAX_BAD_CHARS_RATIO)) {
        // Translation is good (Hebrew).
        break;
      } else {
        // Translation is bad (English).
        if (!firstResult) {
            firstResult = result;
        }
        if (temperature >= 1.5) {
            // Give up - use the translation of the first temperature.
            result = firstResult;
            console.error('Request: '.red, request);
            console.error('Response: '.red, result);
            console.error(`Bad chars ratio: ${badCharsRatio}. Giving up - using translation of low temperature`.red);
            break;
        }
        temperature += 0.1;
        console.error('Request: '.red, request);
        console.error('Response: '.red, result);
        console.error(`Bad chars ratio: ${badCharsRatio}. Retrying with temperature ${temperature}...\nTranslation: ${result.replace(/\n/g, '\n             ')}\n`.red);
      }
    }

    // One subtitle is successfully translated.
    previousSubtitles.push({ role: "user", content: JSON.stringify(input) })
    previousSubtitles.push({ role: 'assistant', content: JSON.stringify({ ...input, Input: result }) })
    subtitle[i].data.text = `${result}\n${text}`

    console.log(`-----------------`.gray)
    console.log(`${i + 1} / ${subtitle.length}`.gray)
    console.log(`${result}`.green)
    console.log(`${text}`.white)
  }
  fs.writeFileSync(`./res/${subtitleFile}`, stringifySync(subtitle, { format: 'srt' }))

}