const ftp = require("basic-ftp");
const fs = require("fs");

async function run() {
    const client = new ftp.Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: "ftp.datasus.gov.br",
        });
        console.log(await client.list("dissemin/publicos"));

        console.log("Download complete");
    }
    catch(err) {
        console.log(err);
    }
    client.close();
}
run();
