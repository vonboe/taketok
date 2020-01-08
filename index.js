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
var maxRetries = 1000;

var deviceIdPrefix = 0;
var iId = 0;
var maxRetryDeviceId = 10;
var retryDeviceIdCount = 0;

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

    let final_url = `${url}&as=${as}&cp=${cp}&mas=${mas}`;
    console.log(final_url);
    return final_url;
};

const generateDeviceId = function () {
    retryDeviceIdCount = 0;

    const _deviceId = _.random(60000000, 99999999);
    const suffix = _.random(1000000000, 10000000000);

    deviceIdPrefix = _deviceId;
    iId = `${_deviceId}${suffix}`;

    console.log("");
    console.log('DEVICE ID PREFIX = ', deviceIdPrefix);
    console.log('IID = ', iId);
    console.log("");
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
    // `73324957${(_.random(1000000000, 10000000000))}`,
    deviceIdPrefix,
    //     '67491113' + (_.random(1000000000, 10000000000)), // randomizing the device_id seems to allow request not requiring auth to go through '6662384847253865990'
    // even randomized device id sometimes doesn't work
    // iid: `733249576192440920`,
    iid: iId,
    // openudid: 'a0b7148b6e5edcb1',
    // device_platform: 'android' + _.random(1, 10000),
    ssmix: "a",
    manifest_version_code: "2018111632",
    dpi: 420,
    app_name: "musical_ly",
    version_name: "9.1.0",
    is_my_cn: 0,
    ac: "wifi",
    update_version_code: "2018111632",
    channel: "googleplay",
    build_number: "9.9.0",
    version_code: 910,
    resolution: "1080*1920",
    mcc_mnc: "23001",
    is_my_cn: 0,
    fp: "",
    app_type: "normal",
});

const api = function (changeDeviceId = false) {
    retryDeviceIdCount++;

    if (deviceIdPrefix == 0) {
        generateDeviceId();
    }

    if (retryDeviceIdCount >= maxRetryDeviceId) {
        generateDeviceId();
    }

    return new TikTokAPI(params, { signURL })
};

const uploadTiktokVideo = function (postId, changeDeviceId = false) {
    retryCount++;

    console.log("");
    console.log("RETRY COUNT = ", retryCount);
    console.log("");

    if (retryCount > maxRetries) {
        console.log("");
        console.log("Message: Max retries have reached. Please try to run it again.");
        console.log("");
    } else {
        const _api = api(changeDeviceId);
        _api.getPost(postId)
            .then(res => {
                console.log("");
                console.log('RES = ', _.get(res, 'data'));
                console.log("");
                let watermark_url = _.find(_.get(res, 'data.aweme_detail.video.download_addr.url_list'),
                    url => _.includes(url, 'watermark'));

                if (!watermark_url) {
                    console.log("");
                    console.log("");
                    console.log('Device ID blocked');
                    console.log('Retrying...');
                    console.log("");
                    console.log("");

                    uploadTiktokVideo(postId, true);
                } else {
                    // duration of the video in ms
                    // _.find(_.get(res, 'data.aweme_detail.duration') / 1000

                    // music only URL
                    // _.first(_.get(res, 'data.aweme_detail.music.play_url.url_list'))

                    // remove watermark, and use highest quality

                    console.log("");
                    console.log('GLOBAL DEVICE ID PREFIX = ', deviceIdPrefix);
                    console.log('GLOBAL IID = ', iId);
                    console.log("");

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
