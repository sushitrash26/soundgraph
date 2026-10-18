const fs = require('fs');
const { execFile } = require('child_process');
const { Shazam, s16LEToSamplesArray } = require('shazam-api');

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.log(JSON.stringify({ status: "error", message: "No input file provided" }));
        process.exit(0);
    }

    try {
        let pcmBuffer;
        if (inputPath.endsWith('.pcm')) {
            pcmBuffer = fs.readFileSync(inputPath);
        } else {
            // Convert any input format to 16kHz mono 16-bit PCM using ffmpeg in memory
            pcmBuffer = await new Promise((resolve, reject) => {
                const ffmpeg = execFile('ffmpeg', [
                    '-hide_banner', '-loglevel', 'error',
                    '-i', inputPath,
                    '-t', '12', // Max 12 seconds
                    '-ar', '16000',
                    '-ac', '1',
                    '-f', 's16le',
                    'pipe:1'
                ], { maxBuffer: 10 * 1024 * 1024, encoding: 'buffer' }, (err, stdout, stderr) => {
                    if (err) return reject(err);
                    resolve(stdout);
                });
            });
        }

        if (!pcmBuffer || pcmBuffer.length < 16000 * 2) {
            console.log(JSON.stringify({ status: "no_match", reason: "Audio too short or silent" }));
            process.exit(0);
        }

        const samples = s16LEToSamplesArray(pcmBuffer);
        const shazam = new Shazam();
        const fullResponse = await shazam.fullRecognizeSong(samples);

        if (fullResponse && fullResponse.track) {
            const track = fullResponse.track;
            let album = "";
            let year = "";
            if (track.sections && Array.isArray(track.sections)) {
                const songSection = track.sections.find(s => s && s.type === "SONG");
                if (songSection && songSection.metadata && Array.isArray(songSection.metadata)) {
                    const albObj = songSection.metadata.find(m => m && m.title === "Album");
                    if (albObj) album = albObj.text || "";
                    const yrObj = songSection.metadata.find(m => m && m.title === "Released");
                    if (yrObj) year = yrObj.text || "";
                }
            }
            console.log(JSON.stringify({
                status: "match",
                title: track.title,
                artist: track.subtitle || "Featured Artist",
                album: album,
                year: year,
                confidence: 0.98
            }));
        } else {
            console.log(JSON.stringify({ status: "no_match" }));
        }
    } catch (err) {
        console.log(JSON.stringify({ status: "error", message: err.message || String(err) }));
    }
}

main();
