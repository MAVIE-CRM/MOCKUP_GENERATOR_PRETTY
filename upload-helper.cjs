const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function upload(base64Data) {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const formData = new URLSearchParams();
    formData.append('image', base64Data);

    const response = await axios.post('https://api.imgbb.com/1/upload?key=635951593c683b772c918ee481d6086f', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.data.url;
  } catch (error) {
    console.error('Upload Helper Error:', error.message);
    throw error;
  }
}

// Se chiamato da riga di comando
if (require.main === module) {
    const data = fs.readFileSync(0, 'utf8');
    upload(data).then(url => console.log(url)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
