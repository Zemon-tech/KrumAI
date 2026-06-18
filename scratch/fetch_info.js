const http = require('http');

const serverUrl = 'http://192.168.1.144:8188';

function fetchSamplingModeDetails() {
  const url = `${serverUrl}/object_info/TextGenerateLTX2Prompt`;
  
  http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const info = JSON.parse(data);
        const nodeInfo = info.TextGenerateLTX2Prompt;
        if (nodeInfo && nodeInfo.input) {
          const samplingModeInfo = nodeInfo.input.required.sampling_mode;
          console.log('=== sampling_mode schema ===');
          console.log(JSON.stringify(samplingModeInfo, null, 2));
        }
      } catch (e) {
        console.error('Failed to parse response:', e.message);
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching details:', err.message);
  });
}

fetchSamplingModeDetails();
