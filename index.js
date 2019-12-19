const { default: TikTokAPI, getRequestParams } = require('tiktok-api');
const crypto = require('crypto');
const _ = require('lodash');
const wget = require('wget-improved');
const urlRegex = require("url-regex");
const fetch = require("node-fetch");
const http = require('http');
const fs = require('fs');

// https://github.com/sudoguy/tiktok_bot/blob/113607be2108fbc56c39ac174557374897e470f8/tiktok_bot/client/utils.py

var retryCount = 0;
var maxRetries = 5;

const uploadLocally = function (url, id) {
    var outputFolder = './downloads/';
    if (!outputFolder.endsWith('/')) outputFolder += '/';

    console.log(`Output folder > ${outputFolder}`);
    console.log(`URL > ${url}`);

    fetch(url)
        .then(res => {
            return res.url;
        })
        .then(urlWithoutWatermark => {
            const file = fs.createWriteStream(`${outputFolder}${id}`);
            const request = http.get(urlWithoutWatermark, function(response) {
                response.pipe(file);
            });
            console.log("UPLOADED!!");
        });

}

const signURL = async (url, ts, deviceId) => {
    console.log(url, ts, deviceId);

    let as_str = String(ts);
    let cp_str = as_str + String(Date.now());

    let as = crypto.createHash('md5').update(as_str).digest('hex');
    let cp = crypto.createHash('md5').update(cp_str).digest('hex');
    let mas_sha = crypto.createHash('sha1').update(as_str).digest('hex');
    let mas = crypto.createHash('md5').update(mas_sha).digest('hex');

    as = 'a1qwert123';
    cp = 'cbfhckdckkde1';
    let final_url = `${url}&as=${as}&cp=${cp}`;
    console.log(final_url);
    return final_url;
};

// Required - device parameters
// You need to source these using a man-in-the-middle proxy such as mitmproxy,
// CharlesProxy or PacketCapture (Android)
const params = getRequestParams({
    // https://github.com/sudoguy/tiktok_bot/blob/bc486ac3c0d12b8c1773d05329fca9374fab0d51/tiktok_bot/api/config.py
    // https://github.com/tolgatasci/musically-tiktok-api-python/wiki/Device-Info-Change
    // suspended https://coding.vivoliker.com/embed/OLP95IXSOo
    device_id:
    // '666238484913368736', // repeated request gets the device id blocked
    // '666238489691542860', // was valid, blocked after 3 requests
        '66623848' + (_.random(1000000000, 10000000000)), // randomizing the device_id seems to allow request not requiring auth to go through '6662384847253865990'
    // even randomized device id sometimes doesn't work
    fp: '',
    iid: '6749111388298184454',
    // openudid: 'a0b7148b6e5edcb1',
    // device_platform: 'android' + _.random(1, 10000),

});

const api = new TikTokAPI(params, { signURL });

const uploadTiktokVideo = function (postId) {
    retryCount++;

    if (retryCount > maxRetries) {
        console.log("");
        console.log("Message: Max retries have reached. Please try to run it again.");
        console.log("");
    } else {
        api.getPost(postId)
            .then(res => {
                //console.log('RES = ', res);
                let watermark_url = _.find(_.get(res, 'data.aweme_detail.video.download_addr.url_list'),
                    url => _.includes(url, 'watermark'));

                if (!watermark_url) {
                    console.log('Device ID blocked');
                    console.log('Retrying...');
                    uploadTiktokVideo(postId);
                } else {
                    // duration of the video in ms
                    // _.find(_.get(res, 'data.aweme_detail.duration') / 1000

                    // music only URL
                    // _.first(_.get(res, 'data.aweme_detail.music.play_url.url_list'))

                    // remove watermark, and use highest quality
                    let video_url = watermark_url
                        .replace('watermark=1', 'watermark=0')
                        .replace('bitrate=0', 'bitrate=1');

                    console.log("Video URL = ", video_url);

                    uploadLocally(video_url, `${res.data.aweme_detail.aweme_id}.mp4`);
                }
            })
            .catch(err => {
                console.log("ERROR", err);
            });
    }
}

if (process.argv.length == 3) {
    // works without proper signing
    // https://gist.github.com/pandafox/c19ad740d53d1da9b2c73ebf3d05f0e3#file-sample_post_detail-json
    uploadTiktokVideo(process.argv[2]);

} else {
    console.log("Message: Missing Post ID.");
    console.log("");
    console.log("Command: node index.js <post-id>");
    console.log("");
    console.log("Example: node index.js 6768815793829383429");
    console.log("");
    console.log("Where to find Post ID:");
    console.log("   1. Go to Tiktok");
    console.log("   2. Access a video post");
    console.log("   3. Get the video post ID from the last segment of the URL");
    process.exit(0);
}
