let fs = require('fs');
let axios = require('axios');
let surah = require('./surah.json');
let reciter = require('./recite');
let ffmpeg = require('fluent-ffmpeg');
var Twit = require('twit');
let video = require('./videos.json').links;

const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.TELEGRAM_TOKEN;

const options = {
  webHook: {
    port: process.env.PORT
  }
};

const url = process.env.APP_URL || 'https://quranvidbot.herokuapp.com:443';

const bot = new TelegramBot(TOKEN, options);
bot.setWebHook(`${url}/bot${TOKEN}`);

function randomint(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}


function parseName(name) {
  return name
    .substring(name.indexOf("/arabic/") + 8, name.indexOf("/64/"))
    .replace(/_/g, " ");
}


function parseNum(num) {
  if (num / 10 < 1) {
    return `00${num}`;
  }
  if (num / 10 < 10) {
    return `0${num}`;
  }
  if (num / 10 >= 10) {
    return `${num}`;
  }
}

function makesrt(rec_Url, text, surah_no, no_ayah) {
  var fs = require('fs');
  var subsrt = require('subsrt');
  ffmpeg.ffprobe(rec_Url, function (err, metadata) {
    if (err) console.log(err);
    var captions = [
      {
        "start": 0, //Time to show caption in milliseconds
        "end": (metadata.format.duration + 0.2) * 1000, //Time to hide caption in milliseconds
        "text": `${text} \n\n Quran ${surah_no}:${no_ayah}` //Plain text content
      }
    ];

    //Build the WebVTT content
    var options = { format: 'srt' };
    var content = subsrt.build(captions, options);

    //Write content to .srt file
    fs.writeFileSync('generated.srt', content);
  })



}



function gen(surah_no = 55, no_ayah = 56, no_reciter = 35, video_url = "", chatId) {
  if (surah_no > 144 || surah_no <= 0)
    return false

  if (no_ayah > surah[surah_no - 1].count || no_ayah <= 0)
    return false

  if (no_reciter > reciter.length - 1 || no_reciter <= 0)
    return false


  rec_Url = `${reciter[no_reciter].audio_url_bit_rate_64}${parseNum(surah_no)}${parseNum(no_ayah)}.mp3`
  console.log(rec_Url);
  let enText = "";
  axios.get(`http://api.alquran.cloud/v1/ayah/${surah_no}:${no_ayah}/editions/en.sahih,ar.alafasy`)
    .then((response) => {
      return response.data.data
    })
    .then((data) => {
      let arText = data[1].text;
      enText = data[0].text;
      makesrt(rec_Url, enText, surah_no, no_ayah);
      return { enText, arText }
    })
    .then(() => {
      var textObj = { enText };
      console.log("aa ", textObj)
      var mergedVideo = ffmpeg();
      let vid = video[randomint(0, video.length - 1)];
      console.log(vid);
      mergedVideo
        .mergeAdd(vid)
        .mergeAdd(vid)
        .mergeAdd(vid)
        .outputOptions('-c:v libx264')
        .outputOptions('-pix_fmt yuv420p')
        .outputOptions('-f mp4')
        .on('error', function (err) {
          console.log('Error merger ' + err.message);
          setTimeout(() => {
            gen();
          }, 6000);
        })
        .on('end', () => {

          console.log('Finished! text = ', textObj);
          let a = textObj.enText;
          var proc = ffmpeg('./mergedVideo11.mp4')
            // .input('./002255 (1).mp3')
            .input(rec_Url)
            .outputOptions([
              "-vf subtitles=./generated.srt:force_style='Alignment=10'",
              '-map 0:v',
              '-map 1:a',
              '-shortest',
            ])
            .on('end', function () {
              console.log('file has been converted finally succesfully');
              console.log("done...");

              var filePath = './newpost.mp4';
              //send to user
              bot.sendMessage(chatId, `Sending File...`);
              bot.sendAudio(chatId, filePath);
            })
            .on('error', function (err) {
              console.log('an error happened: ' + err.message);
              setTimeout(() => {
                gen();
              }, 6000);
            })
            // save to file
            .save('./newpost.mp4');

        })
        .mergeToFile('./mergedVideo11.mp4');

    })

    .catch((err) => {
      console.log("err axios");
      setTimeout(() => {
        gen();
      }, 6000);
    })


}


// Just to ping!
bot.on('message', function onMessage(msg) {
  bot.sendMessage(msg.chat.id, 'I am alive on Heroku!');
});

bot.onText(/\/gen/, (msg) => {
  bot.sendMessage(msg.chat.id, `Dear ${msg.from.first_name}, Processing Your Request `);
  let surah_no = randomint(1, 114);
  let no_ayah = randomint(2, surah[surah_no - 1].count);
  let no_reciter = 35;//randomint(0, reciter.length - 1)
  gen(surah_no, no_ayah, no_reciter, video = "", msg.chat.id);
});
