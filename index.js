let fs = require('fs');
let axios = require('axios');
let surah = require('./surah.json');
let reciter = require('./recite');
let ffmpeg = require('fluent-ffmpeg');
var Twit = require('twit');
let no_ayah = 1;
let surah_no = 1;
let video = require('./videos.json').links;

let T = new Twit({
  access_token: process.env.ACCESS_TOKEN, //|| config.access_token,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET, //|| config.access_token_secret,
  consumer_key: process.env.CONSUMER_KEY, //|| config.consumer_key,
  consumer_secret: process.env.CONSUMER_SECRET //|| config.consumer_secret
});


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
function makesrt(rec_Url, text) {
  var fs = require('fs');
  var subsrt = require('subsrt');
  ffmpeg.ffprobe(rec_Url, function (err, metadata) {
    if (err) console.log(err);

    // console.dir(metadata); // all metadata
    // console.log(metadata.format.duration);
    //Sample captions
    var captions = [
      {
        "start": 0, //Time to show caption in milliseconds
        "end": (metadata.format.duration + 4) * 1000, //Time to hide caption in milliseconds
        "text": text //Plain text content
      }
    ];

    //Build the WebVTT content
    var options = { format: 'srt' };
    var content = subsrt.build(captions, options);

    //Write content to .srt file
    fs.writeFileSync('generated.srt', content);
  })



}



function gen() {
  surah_no = randomint(1, 114);
  no_ayah = randomint(2, surah[surah_no - 1].count);
  no_reciter = 35;//randomint(0, reciter.length - 1)
  rec_Url = `${reciter[no_reciter].audio_url_bit_rate_64}${parseNum(surah_no)}${parseNum(no_ayah)}.mp3`
  console.log(rec_Url);
  let enText = "";
  axios.get(`http://api.alquran.cloud/v1/ayah/${surah_no}:${no_ayah}/editions/en.sahih,ar.alafasy`)
    .then((response) => {
      // console.log(response.data.data);
      return response.data.data
    })
    .then((data) => {
      let arText = data[1].text;
      let audUrl = data[1].audio;
      enText = data[0].text;
      makesrt(rec_Url, enText);

      // console.log({ enText, arText, rec_Url });

      return { enText, arText }


    })
    .then(() => {
      var textObj = { enText };
      // var textObj = { enText: 'However, what if you want to \n loop through the cars and fi\n loop through the cars and fi' };
      console.log("aa ", textObj)
      var mergedVideo = ffmpeg();

      mergedVideo
        // .input('./video.mp4')
        .mergeAdd(video[randomint(0, video.length - 1)])
        .mergeAdd(video[randomint(0, video.length - 1)])
        .mergeAdd(video[randomint(0, video.length - 1)])
        // .mergeAdd('https://player.vimeo.com/external/291648067.sd.mp4?s=7f9ee1f8ec1e5376027e4a6d1d05d5738b2fbb29&profile_id=164&oauth2_token_id=57447761')
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

              var filePath = './newpost.mp4'
              T.postMediaChunked({ file_path: filePath, media_category: 'video/mp4' }, function (err, data, response) {
                console.log(data)
                var mediaIdStr = data.media_id_string
                var altText = "Quran Recitation."
                var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } }
                console.log('file 1 succesfully');
                setTimeout(() => {
                  T.post('media/metadata/create', meta_params, function (err, data, response) {
                    if (!err) {
                      // now we can reference the media and post a tweet (media will attach to the tweet)
                      var params = { status: 'DailyAyah.herokuapp.com #islam #quran', media_ids: [mediaIdStr] }
                      console.log('file 2 succesfully = ');
                      T.post('statuses/update', params, function (err, data, response) {
                        if (data.errors.length !== 0) {
                          console.log("retrying");
                          setTimeout(() => {
                            gen();
                          }, 6000);
                        } else {
                          console.log("file 3 successfull too")
                        }

                      })

                    } else {
                      console.log(err);
                    }


                  })
                }, 3000);

              })

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
      // .save('mergedVideo11.mp4')

    })

    .catch((err) => {
      console.log("err axios");
      setTimeout(() => {
        gen();
      }, 6000);
    })


}


gen();