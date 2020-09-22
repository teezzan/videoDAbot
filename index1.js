let fs = require('fs');
let textToImage = require('text-to-image');
let axios = require('axios');
let surah = require('./surah.json');
let reciter = require('./recite');
let ffmpeg = require('fluent-ffmpeg');
var Twit = require('twit');
let no_ayah = 1;
let surah_no = 1;

// let config = require('./config')
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



function gen() {
  surah_no = randomint(1, 114);
  no_ayah = randomint(2, surah[surah_no - 1].count);
  no_reciter = randomint(0, reciter.length - 1)
  rec_Url = `${reciter[no_reciter].audio_url_bit_rate_64}${parseNum(surah_no)}${parseNum(no_ayah)}.mp3`
  console.log(rec_Url);

  axios.get(`http://api.alquran.cloud/v1/ayah/${surah_no}:${no_ayah}/editions/en.sahih,ar.alafasy`)
    .then((response) => {
      console.log(response.data.data);
      return response.data.data
    })
    .then((data) => {
      let enText = data[0].text;
      let arText = data[1].text;
      let audUrl = data[1].audio;
      console.log({ enText, arText, rec_Url });

      return { enText, arText }


    })
    .then((textObj) => {
      //${textObj.arText} \n\n

      textToImage.generate(`\n${textObj.enText}\n\nQuran ${surah_no}:${no_ayah}\nReciter: ${parseName(rec_Url)}\n\nDailyAyahBot`, {
        fontFamily: 'Comic Sans',
        margin: 10,
        maxWidth: 720,
        textAlign: "center",
        fontSize: 22,
        // bgColor: "black",
        // textColor: "white"
      }).then(function (base64Image) {
        base64Image = base64Image.split(';base64,').pop();
        fs.writeFile('./images/image.png', base64Image, { encoding: 'base64' }, function (err) {
          console.log('File created');
        });
      }).then(() => {
        // From a local path...
        ffmpeg.ffprobe(rec_Url, function (err, metadata) {
          if (err) console.log(err);

          // console.dir(metadata); // all metadata
          console.log(metadata.format.duration);
          var proc = ffmpeg('./images/image.png')
            .loop(metadata.format.duration)
            .input(rec_Url)
            .outputOptions('-c:v libx264')
            .outputOptions('-pix_fmt yuv420p')
            .outputOptions('-f mp4')
            // setup event handlers
            .on('end', function () {
              console.log('file has been converted succesfully');
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
            })
            // save to file
            .save('./newpost.mp4', () => {

            })

        })

      });


    })
    .catch((err) => {
      console.log(err);
      setTimeout(() => {
        gen();
      }, 6000);
    })

}


gen();