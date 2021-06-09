/**
 * tools-snap-service
 *
 * node.js web service for puppeteer/chrome to generate PDFs or PNGs from HTML.
 *
 * Accepts POST requests to /snap with either an HTTP file upload sent with
 * the name "html" or body form data with HTML content in a field named `html`.
 * Alternatively, we accept a `url` parameter which renders an arbitrary URL on
 * the internet, subject to our internal list of allowed domains.
 *
 * This service is not meant to be exposed to the public, and use of this
 * service should be mediated by another application with access controls.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const async = require('async');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const { query, body, validationResult } = require('express-validator');
const url = require('url');
const { Semaphore } = require('await-semaphore');
const puppeteer = require('puppeteer');
const mime = require('mime-types');
const imgSize = require('image-size');
const util = require('util');
const log = require('./log');

const dump = util.inspect;

// Load our list of custom logos. We do it early on in order to validate against
// the possible values and give a more informative validation error.
const logos = require('./logos/_list.json');

// It's impossible to regex a CSS selector so we'll assemble a list of the most
// common characters. Feel free to add to this list if it's preventing a legitimate
// selector from being used. The space at the beginning of this string is intentional.
const allowedSelectorChars = ' #.[]()-_=+:~^*abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// PDF paper sizes
const allowedFormats = ['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

// PDF margin units
const allowedPdfMarginUnits = ['px', 'mm', 'cm', 'in'];

// An array of hostnames snap is allowed to connect to.
const allowedHostnames = (process.env.ALLOWED_HOSTNAMES || 'localhost').split(',');

// Helper function.
function ated(request) {
  return request.headers['x-forwarded-for']
    || request.connection.remoteAddress
    || request.socket.remoteAddress
    || (request.connection.socket ? request.connection.socket.remoteAddress : null);
}

/**
 * A semaphore to limit the maximum number of concurrent active requests to
 * puppeteer, and require that new requests wait until previous ones are
 * disconnected before connecting.
 */
const PUPPETEER_SEMAPHORE = new Semaphore(process.env.MAX_CONCURRENT_REQUESTS || 4);

/**
 * Launch Puppeteer.
 *
 * Using the launch() command multiple times results in multiple Chromium procs
 * but (just like a normal web browser) we only want one. We'll open a new "tab"
 * each time our `/snap` route is invoked by reusing the established connection.
 */
let browserWSEndpoint = '';

async function connectPuppeteer() {
  try {
    let browser;

    if (browserWSEndpoint) {
      browser = await puppeteer.connect({ browserWSEndpoint });
    } else {
      // Initialize Puppeteer
      browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        args: [
          '--headless',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--remote-debugging-port=9222',
          '--remote-debugging-address=0.0.0.0',
          '--no-sandbox',
        ],
        dumpio: false, // set to `true` for debugging
      });

      // Log UA for visibility in ELK.
      const ua = await browser.userAgent();
      log.info(`New connection to Chrome. UA: ${ua}`);

      // Create re-usable connection.
      browserWSEndpoint = browser.wsEndpoint();
    }

    return browser;
  } catch (err) {
    throw err;
  }
}

// Set up the Express app
const app = express();

app.set('env', process.env.NODE_ENV || 'dockerdev');
app.set('port', process.env.PORT || 80);

app.use(bodyParser.urlencoded({
  extended: true,
  limit: '10mb',
  uploadDir: '/tmp',
}));

app.use(methodOverride());

app.disable('x-powered-by');

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (process.env.NODE_ENV !== 'test') {
    log.error(`Error: ${JSON.stringify(err)}`);
  }

  res.status(err.code || 500);
  res.send('Error');
});

// Health check
app.get('/status', (req, res) => res.status(204).send());

// Snaps
app.post('/snap', [
  body('html', '').optional(),
  query('url', 'Must be a valid, fully-qualified URL').optional().isURL({ require_protocol: true, disallow_auth: true, validate_length: false }),
  query('width', 'Must be an integer with no units').optional().isInt(),
  query('height', 'Must be an integer with no units').optional().isInt(),
  query('scale', 'Must be an integer in the range: 1-3').optional().isInt({ min: 1, max: 3 }),
  query('media', 'Must be one of the following: print, screen').optional().isIn(['print', 'screen']),
  query('output', 'Must be one of the following: png, pdf').optional().isIn(['png', 'pdf']),
  query('selector', `Must be a CSS selector made of the following characters: ${allowedSelectorChars}`).optional().isWhitelisted(allowedSelectorChars),
  query('pdfFormat', `Must be one of the following values: ${allowedFormats.join(', ')}`).optional().isIn(allowedFormats),
  query('pdfLandscape', 'Must be one of the following: true, false').optional().isBoolean(),
  query('pdfBackground', 'Must be one of the following: true, false').optional().isBoolean(),
  query('pdfMarginTop', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginRight', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginBottom', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginLeft', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginUnit', `Must be one of the following values: ${allowedPdfMarginUnits.join(', ')}`).optional().isIn(allowedPdfMarginUnits),
  query('user', 'Must be an alphanumeric string').optional().isAlphanumeric(),
  query('pass', 'Must be an alphanumeric string').optional().isAlphanumeric(),
  query('logo', `Must be one of the following values: ${Object.keys(logos).join(', ')}. If you would like to use your site's logo with Snap Service, please read how to add it at https://github.com/UN-OCHA/tools-snap-service#custom-logos`).optional().isIn(Object.keys(logos)),
  query('service', 'Must be an alphanumeric string identifier (hyphens, underscores are also allowed).').optional().matches(/^[A-Za-z0-9_-]+$/),
  query('ua', '').optional(),
  query('delay', 'Must be an integer between 0-10000 inclusive.').optional().isInt({ min: 0, max: 10000 }),
  query('debug', 'Must be a Boolean').optional().isBoolean(),
  query('block', 'Must be a comma-separated list of domains (alphanumeric, hyphens, dots, commas)').optional().matches(/^[A-Za-z0-9.,-]+$/),
], (req, res) => {
  // debug
  log.debug('Request received', { query: url.parse(req.url).query });

  // If neither `url` and `html` are present, return 422 requiring valid input.
  if (!req.query.url && !req.body.html) {
    return res.status(422).json({
      errors: [
        {
          location: 'query',
          param: 'url',
          value: undefined,
          msg: 'You must supply either `url` as a querystring parameter, or `html` as a URL-encoded form field.',
        },
        {
          location: 'body',
          param: 'html',
          value: undefined,
          msg: 'You must supply either `url` as a querystring parameter, or `html` as a URL-encoded form field.',
        },
      ],
    });
  }

  // If both `url` and `html` are present, return 422 requiring valid input.
  if (req.query.url && req.body.html) {
    return res.status(422).json({
      errors: [
        {
          location: 'query',
          param: 'url',
          value: req.query.url,
          msg: 'You must supply either `url` as a querystring parameter, OR `html` as a URL-encoded form field, but not both.',
        },
        {
          location: 'body',
          param: 'html',
          value: req.body.html,
          msg: 'You must supply either `url` as a querystring parameter, OR `html` as a URL-encoded form field, but not both.',
        },
      ],
    });
  }

  // Ensure a passed url is on the permitted list or includes a substring that
  // is on the permitted list.
  if (req.query.url) {
    const urlHash = new URL(req.query.url);

    // Check if any of the allowed hostnames are substrings of `url.hostname`
    // This allowed a domain suffix match as well as a full hostname match.
    if (!allowedHostnames.some(allowedHost => urlHash.hostname.includes(allowedHost))) {
      return res.status(422).json({
        errors: [
          {
            location: 'query',
            param: 'url',
            value: urlHash.hostname,
            msg: `${urlHash.hostname} does not match any allowed hostname.`,
          },
        ],
      });
    }
  }

  // Validate input errors, return 422 for any problems.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  // Housekeeping
  const startTime = Date.now();
  let tmpPath = '';
  let sizeHtml = 0;

  // Assign validated querystring params to variables and set defaults.
  const fnUrl = req.query.url || false;
  const fnHtml = req.body.html || '';
  const fnWidth = Number(req.query.width) || 800;
  const fnHeight = Number(req.query.height) || 600;
  const fnScale = Number(req.query.scale) || 2;
  const fnMedia = req.query.media || 'screen';
  const fnOutput = req.query.output || 'pdf';
  const fnPdfFormat = req.query.pdfFormat || 'A4';
  const fnPdfLandscape = Boolean(req.query.pdfLandscape === 'true') || false;
  const fnPdfBackground = Boolean(req.query.pdfBackground === 'true') || false;
  const fnPdfMarginTop = req.query.pdfMarginTop || '0';
  const fnPdfMarginRight = req.query.pdfMarginRight || '0';
  const fnPdfMarginBottom = req.query.pdfMarginBottom || '64';
  const fnPdfMarginLeft = req.query.pdfMarginLeft || '0';
  const fnPdfMarginUnit = req.query.pdfMarginUnit || 'px';
  const fnPdfHeader = req.query.pdfHeader || '';
  const fnPdfFooter = req.query.pdfFooter || '';
  const fnAuthUser = req.query.user || '';
  const fnAuthPass = req.query.pass || '';
  const fnCookies = req.query.cookies || '';
  const fnSelector = req.query.selector || '';
  const fnFullPage = fnSelector === '' ? true : false;
  const fnLogo = req.query.logo || false;
  const fnService = req.query.service || '';
  const fnUserAgent = req.query.ua || req.headers['user-agent'] || '';
  const fnDelay = Number(req.query.delay) || 0;
  const fnDebug = Boolean(req.query.debug) || false;
  const fnBlock = req.query.block || '';

  // Declare options objects here so that multiple scopes have access to them.
  let pngOptions = {};
  let pdfOptions = {};

  // Make a nice blob for the logs. ELK will sort this out. Blame Emma.
  const ip = ated(req);
  const lgParams = {
    url: fnUrl,
    html: fnHtml,
    width: fnWidth,
    height: fnHeight,
    scale: fnScale,
    media: fnMedia,
    output: fnOutput,
    format: fnPdfFormat,
    pdfLandscape: fnPdfLandscape,
    pdfBackground: fnPdfBackground,
    pdfMarginTop: fnPdfMarginTop,
    pdfMarginRight: fnPdfMarginRight,
    pdfMarginBottom: fnPdfMarginBottom,
    pdfMarginLeft: fnPdfMarginLeft,
    pdfMarginUnit: fnPdfMarginUnit,
    pdfHeader: fnPdfHeader,
    pdfFooter: fnPdfFooter,
    authuser: fnAuthUser,
    authpass: (fnAuthPass ? '*****' : ''),
    cookies: fnCookies,
    selector: fnSelector,
    fullpage: fnFullPage,
    logo: fnLogo,
    service: fnService,
    ua: fnUserAgent,
    ip,
    delay: fnDelay,
    debug: '', // gets filled in as needed
    block: fnBlock,
  };

  async.series([
    function validateRequest(cb) {
      // Validate uploaded HTML file
      if (req.files && req.files.html && req.files.html.path) {
        fs.stat(req.files.html.path, (err, stats) => {
          if (err || !stats || !stats.isFile()) {
            log.error({ files: req.files, stats }, 'An error occurred while trying to validate the HTML upload.');
            return cb(new Error('An error occurred while trying to validate the HTML upload.'));
          }

          sizeHtml = stats.size || 0;
          const fileName = req.files.html.path;
          tmpPath = `${fileName}.${fnOutput}`;

          lgParams.size = sizeHtml;
          lgParams.tmpfile = tmpPath;
        });
      } else if (req.body && req.body.html && req.body.html.length) {
        tmpPath = `/tmp/snap-${Date.now()}.html`;
        sizeHtml = req.body.html.length;

        fs.writeFile(tmpPath, req.body.html, (err) => {
          if (err) {
            log.error({ body: req.body }, 'An error occurred while trying to validate the HTML post data.');
            return cb(new Error('An error occurred while trying to validate the HTML post data.'));
          }

          lgParams.size = sizeHtml;
          lgParams.tmpfile = tmpPath;
        });
      } else if (req.query.url) {
        const digest = crypto.createHash('md5').update(fnUrl).digest('hex');
        tmpPath = `/tmp/snap-${Date.now()}-${digest}.${fnOutput}`;
        lgParams.tmpfile = tmpPath;
      } else {
        const noCaseErrMsg = 'An HTML file was not uploaded or could not be accessed.';
        log.error(noCaseErrMsg);
        return cb(new Error(noCaseErrMsg));
      }

      return cb(null, 'everything is fine');
    },
    function generateResponse(cb) {
      /**
       * Puppeteer code to generate PNG/PDF Snap.
       */
      async function createSnap() {
        try {
          pngOptions = {
            path: tmpPath,
            fullPage: fnFullPage,
          };

          pdfOptions = {
            path: tmpPath,
            format: fnPdfFormat,
            landscape: fnPdfLandscape,
            printBackground: fnPdfBackground,
            displayHeaderFooter: !!fnPdfHeader || !!fnPdfFooter,
            headerTemplate: fnPdfHeader,
            footerTemplate: fnPdfFooter,
            margin: {
              top: fnPdfMarginTop + fnPdfMarginUnit,
              right: fnPdfMarginRight + fnPdfMarginUnit,
              bottom: fnPdfMarginBottom + fnPdfMarginUnit,
              left: fnPdfMarginLeft + fnPdfMarginUnit,
            },
          };

          // Do string substitution on fnPdfHeader if the logo was specified.
          if (Object.prototype.hasOwnProperty.call(logos, fnLogo)) {
            const pdfLogoFile = path.join(__dirname, '/logos/', logos[fnLogo].filename);
            // eslint-disable-next-line new-cap
            const pdfLogoData = new Buffer.from(fs.readFileSync(pdfLogoFile, 'binary'));
            const pdfLogo = {
              src: `data:${mime.lookup(pdfLogoFile)};base64,${pdfLogoData.toString('base64')}`,
              // Dimensions reduced to 3/4 size because the PDF contents are
              // rendered at 96ppi but the header is 72ppi.
              width: imgSize(pdfLogoFile).width * 0.75,
              height: imgSize(pdfLogoFile).height * 0.75,
            };

            pdfOptions.headerTemplate = fnPdfHeader
              .replace('__LOGO_SRC__', pdfLogo.src)
              .replace('__LOGO_WIDTH__', pdfLogo.width)
              .replace('__LOGO_HEIGHT__', pdfLogo.height);
          }
        } catch (err) {
          return cb(err);
        }

        await PUPPETEER_SEMAPHORE.use(async () => {
          try {
            // Access the Chromium instance by either launching or connecting to
            // Puppeteer.
            const browser = await connectPuppeteer().catch(err => {
              throw err;
            });

            // New Puppeteer Incognito context and create a new page within.
            const context = await browser.createIncognitoBrowserContext();
            const page = await context.newPage();

            // Set duration until Timeout
            await page.setDefaultNavigationTimeout(60 * 1000);

            // We want to intercept requests in order to dump logs or block domains.
            if (fnDebug || fnBlock) {
              await page.setRequestInterception(true);

              // BLOCK ADS/TRACKERS
              await page.on('request', (pageReq) => {
                const blacklist = fnBlock.split(',');

                let domain = null;
                const frags = pageReq.url().split('/');
                if (frags.length > 2) {
                  domain = frags[2];
                }

                // Block request if a blacklisted domain is found
                if (fnBlock && blacklist.some((blocked) => domain.indexOf(blocked) !== -1)) {
                  lgParams.debug += `Snap blocked a request to ${domain}\n`;
                  pageReq.abort();
                } else {
                  pageReq.continue();
                }
              });
            }

            if (fnDebug) {
              // Log caught exceptions
              page.on('error', (err) => {
                lgParams.debug += err.toString();
              });

              // Log uncaught exceptions
              page.on('pageerror', (err) => {
                lgParams.debug += err.toString();
              });

              // Forward all console output
              page.on('console', msg => {
                const errText = msg._args && msg._args[0] && msg._args[0]._remoteObject && msg._args[0]._remoteObject.value;
                lgParams.debug += `${msg._type.padStart(7)} ${dump(errText)}\n`;
              });
            }

            // Use HTTP auth if needed (for testing staging envs)
            if (fnAuthUser && fnAuthPass) {
              await page.authenticate({ username: fnAuthUser, password: fnAuthPass });
            }

            // Set viewport dimensions
            await page.setViewport({ width: fnWidth, height: fnHeight, deviceScaleFactor: fnScale });

            // Set CSS Media
            await page.emulateMediaType(fnMedia);

            // Compile cookies if present. We have to manually specify some extra
            // info such as host/path in order to create a valid cookie.
            const cookies = [];
            if (!!fnCookies) {
              fnCookies.split('; ').map((cookie) => {
                const thisCookie = {};
                const [name, value] = cookie.split('=');

                thisCookie.url = fnUrl;
                thisCookie.name = name;
                thisCookie.value = value;

                cookies.push(thisCookie);
              });
            }

            // Set cookies.
            cookies.forEach(async function setCookies(cookie) {
              await page.setCookie(cookie).catch((err) => {
                log.error(err);
              });
            });

            // We need to load the HTML differently depending on whether it's HTML
            // in the POST or a URL in the querystring.
            if (fnUrl) {
              await page.goto(fnUrl, {
                waitUntil: ['load', 'networkidle0'],
              });
            } else {
              await page.goto(`data:text/html,${fnHtml}`, {
                waitUntil: ['load', 'networkidle0'],
              });
            }

            // Add a conditional class indicating what type of Snap is happening.
            // Websites can use this class to apply customizations before the final
            // asset (PNG/PDF) is generated.
            //
            // Note: page.evaluate() is a stringified injection into the runtime.
            //       any arguments you need inside this function block have to be
            //       explicitly passed instead of relying on closure.
            await page.evaluate((snapOutput) => {
              // eslint-disable-next-line no-undef
              document.documentElement.classList.add(`snap--${snapOutput}`);
            }, fnOutput);

            // Output PNG or PDF?
            if (fnOutput === 'png') {
              // Output whole document or DOM fragment?
              if (fnSelector) {
                pngOptions.omitBackground = true;

                // Make sure our selector is in the DOM.
                await page.waitForSelector(fnSelector).then(async () => {
                  // Select the element from the DOM.
                  const fragment = await page.$(fnSelector).catch((err) => {
                    throw err;
                  });

                  // If an artificial delay was specified, wait for that amount of time.
                  if (fnDelay) {
                    await page.waitFor(fnDelay);
                  }

                  // Finally, take the screenshot.
                  //
                  // NOTE: in previous versions of Puppeteer we had difficulties
                  // with PNG bounding boxes. We fixed it by switching to the a
                  // manual method of clipping PNGs using fragment.boundingBox()
                  // then executing page.screenshot().
                  //
                  // After a few Chrome/Puppeteer upgrades, the problem returned
                  // in a slightly different form, again resolved by commenting
                  // the code back out and using the "convenience" method again:
                  // fragment.screenshot()
                  //
                  // It might be necessary to flip-flop between these two methods
                  // from time to time so it's been left intact but commented out.
                  //
                  // @see https://humanitarian.atlassian.net/browse/SNAP-51
                  await fragment.screenshot(pngOptions);

                  // const elementBoundingBox = await fragment.boundingBox();
                  // pngOptions.clip = {
                  //   x: elementBoundingBox.x,
                  //   y: elementBoundingBox.y,
                  //   width: elementBoundingBox.width,
                  //   height: elementBoundingBox.height,
                  // };
                  // await page.screenshot(pngOptions);
                }).catch((err) => {
                  throw err;
                });
              } else {
                // If an artificial delay was specified, wait for that amount of time.
                if (fnDelay) {
                  await page.waitFor(fnDelay);
                }

                // Finally, take the screenshot.
                await page.screenshot(pngOptions);
              }
            } else {
              // If an artificial delay was specified, wait for that amount of time.
              if (fnDelay) {
                await page.waitFor(fnDelay);
              }

              await page.pdf(pdfOptions);
            }

            // Disconnect from Puppeteer process
            await context.close();
            await browser.disconnect();
          } catch (err) {
            throw err;
          }
        });
      }

      /**
       * Express response and tmp file cleanup.
       */
      createSnap().then(() => {
        res.charset = 'utf-8';

        if (fnOutput === 'png') {
          res.contentType('image/png');
          res.sendFile(tmpPath, () => {
            const duration = ((Date.now() - startTime) / 1000);
            res.end();
            lgParams.duration = duration;
            log.info(lgParams, `PNG successfully generated in ${duration} seconds.`);
            return fs.unlink(tmpPath, cb);
          });
        } else {
          res.contentType('application/pdf');
          res.sendFile(tmpPath, () => {
            const duration = ((Date.now() - startTime) / 1000);
            res.end();
            lgParams.duration = duration;
            log.info(lgParams, `PDF successfully generated in ${duration} seconds.`);
            return fs.unlink(tmpPath, cb);
          });
        }
      }).catch((err) => {
        return cb(err);
      });
    },
  ],
  (err) => {
    const duration = ((Date.now() - startTime) / 1000);

    if (err) {
      lgParams.fail = true;
      lgParams.stack_trace = err.stack;
      lgParams.duration = duration;
      log.error(lgParams, `Snap FAILED in ${duration} seconds. ${err}`);
      res.status(500).send('Internal Server Error');
    }
  });
});

http.createServer(app).listen(app.get('port'), () => {
  log.info('⚡️ Express server configured for', (process.env.MAX_CONCURRENT_REQUESTS || 4), 'concurrent requests listening on port:', app.get('port'));
});
