/**
 * print-api
 * node.js web service for puppeteer/chrome for generating PDFs or PNGs from HTML.
 *
 * Accepts POST requests to /print with either a HTTP file upload sent with
 * the name "html" or body form data with HTML content in a field named "html".
 *
 * The service will run hrome and return the generated PDF or PNG data.
 *
 * This service is not meant to be exposed to the public, and use of this
 * service should be mediated by another application with access controls.
 *
 */
const fs = require('fs');
const crypto = require('crypto');
const async = require('async');
const http = require('http');
const https = require('https');
const puppeteer = require('puppeteer');
const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const log = require('./log');

// We don't set this as a variable because it defines its own vars inside
require('./config');

// Set http and https default maxSockets to Infinity to avoid artificial
// constraints in Node < 0.12.
http.globalAgent.maxSockets = Infinity;
https.globalAgent.maxSockets = Infinity;

// Set up the application
const app = express();

app.set('env', process.env.NODE_ENV || 'dockerdev');
app.set('port', process.env.PORT || 80);

app.use(bodyParser.urlencoded({
  extended: true,
  limit: '10mb',
  uploadDir: '/tmp',
}));

app.use(methodOverride());

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== 'test') {
    log.error(`Error: ${JSON.stringify(err)}`);
  }

  res.status(err.code || 500);
  res.send('Error');
});

app.post('/print', (req, res) => {
  let fnHtml = '';
  let sizeHtml = 0;
  let fnFormat = 'pdf';
  let fnPdf = '';
  let fnPng = '';
  let fnUrl = false;
  const startTime = Date.now();

  async.series([
    function validateRequest(cb) {
      // What output?
      if (req.format && req.format === 'png') {
        fnFormat = 'png';
      }

      // Validate uploaded HTML file
      if (req.files && req.files.html && req.files.html.path) {
        fs.stat(req.files.html.path, (err, stats) => {
          if (err || !stats || !stats.isFile()) {
            log.error({ files: req.files, stats }, 'An error occurred while trying to validate the HTML upload.');
            return cb(new Error('An error occurred while trying to validate the HTML upload.'));
          }

          fnHtml = req.files.html.path;
          sizeHtml = stats.size || 0;
          fnPdf = `${fnHtml}.pdf`;
          fnPng = `${fnHtml}.png`;

          return cb();
        });
      } else if (req.body && req.body.html && req.body.html.length) {
        fnHtml = `/tmp/htmltopdf-${Date.now()}.html`;
        sizeHtml = req.body.html.length;
        fs.writeFile(fnHtml, req.body.html, (err) => {
          if (err) {
            log.error({ body: req.body }, 'An error occurred while trying to validate the HTML post data.');
            return cb(new Error('An error occurred while trying to validate the HTML post data.'));
          }

          fnPdf = `${fnHtml}.pdf`;
          fnPng = `${fnHtml}.png`;

          return cb();
        });
      } else if (req.query && req.query.url && req.query.url.length && (req.query.url.substr(0, 7) === 'http://' || req.query.url.substr(0, 8) === 'https://')) {
        const md5sum = crypto.createHash('md5');
        const digest = md5sum.digest('hex');

        fnHtml = req.query.url;
        md5sum.update(fnHtml);
        fnPdf = `/tmp/htmltopdf-${digest}-${Date.now()}.pdf`;
        fnPng = `/tmp/htmltopdf-${digest}-${Date.now()}.png`;
        fnUrl = true;
      } else {
        log.error('An HTML file was not uploaded or could not be accessed.');
        return cb(new Error('An HTML file was not uploaded or could not be accessed.'));
      }

      return cb();
    },
    function generateResponse(cb) {
      async function createSnap() {
        // Process HTML file with puppeteer
        const browser = await puppeteer.launch({
          executablePath: '/usr/bin/google-chrome',
          args: [
            '--headless',
            '--disable-gpu',
            '--remote-debugging-port=9222',
            '--remote-debugging-address=0.0.0.0',
            '--no-sandbox',
            '--disable-dev-shm-usage',
          ],
        });
        const page = await browser.newPage();
        await page.goto(fnHtml);
        if (fnFormat === 'png') {
          await page.screenshot({ path: fnPng });
        } else {
          await page.pdf({ path: fnPdf, format: 'A4' });
        }
        await browser.close();
      }

      createSnap().then(() => {
        res.charset = 'utf-8';
        if (fnFormat === 'png') {
          res.contentType('image/png');
          res.sendfile(fnPng, () => {
            res.end();
            const duration = ((Date.now() - startTime) / 1000);
            log.info({ duration, inputSize: sizeHtml }, `PNG ${fnPng} successfully generated for HTML ${fnHtml} in ${duration} seconds.`);
          });
        } else {
          res.contentType('application/pdf');
          res.sendfile(fnPdf, () => {
            res.end();
            const duration = ((Date.now() - startTime) / 1000);
            log.info({ duration, inputSize: sizeHtml }, `PDF ${fnPdf} successfully generated for HTML ${fnHtml} in ${duration} seconds.`);
          });
        }
        if (fnHtml.length && fnUrl === false) {
          return fs.unlink(fnHtml, cb);
        }
        if (fnFormat === 'png' && fnPng.length) {
          return fs.unlink(fnPng, cb);
        }
        if (fnFormat === 'pdf' && fnPdf.length) {
          return fs.unlink(fnPdf, cb);
        }
        log.info(`Successfully removed input (${fnHtml}) and output (${fnPdf}) files.`);

        return true;
      }).catch((err) => {
        console.error('createSnap', err);
      });
    },
  ],
  (err) => {
    if (err) {
      const duration = ((Date.now() - startTime) / 1000);
      log.warn({ duration, inputSize: sizeHtml }, `Hardcopy generation failed for HTML ${fnHtml} in ${duration} seconds.`);
      res.send(500, 'Error');
    }
  });
});

http.createServer(app).listen(app.get('port'), () => {
  console.log('Express server listening on port:', app.get('port'));
});
