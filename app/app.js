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
// common characters. Feel free to add to this list if it's preventing a legit
// selector from being used.
//
// The space at the beginning of this string is intentional.
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
 *
 * Allow the use of the standard puppeteer browser executable override.
 */
let browserWSEndpoint = '';

async function connectPuppeteer() {
  let browser;

  if (browserWSEndpoint) {
    browser = await puppeteer.connect({ browserWSEndpoint });
  } else {
    // Initialize Puppeteer
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
      args: [
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0',
        '--no-sandbox',
      ],
      headless: 'new',
      dumpio: false, // set to `true` for debugging
    });

    // Log UA for visibility in ELK.
    const ua = await browser.userAgent();
    log.info(`New connection to Chrome. UA: ${ua}`);

    // Create re-usable connection.
    browserWSEndpoint = browser.wsEndpoint();
  }

  return browser;
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

app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    log.error(`Error: ${JSON.stringify(err)}`);
  }

  res.status(err.code || 500);
  res.send('Error');
});

// Health check
app.get('/status', (req, res) => {
  // Calculate the number of in-flight requests. The semaphore count is
  // decreased by 1 for each concurrent snap, so the maths are simple.
  const semaphoreSize = process.env.MAX_CONCURRENT_REQUESTS || 4;
  const inFlightRequests = semaphoreSize - PUPPETEER_SEMAPHORE.count;

  if (inFlightRequests <= semaphoreSize) {
    res.status(200).send(`Healthy. There are ${inFlightRequests}/${process.env.MAX_CONCURRENT_REQUESTS} requests in flight.`);
  } else {
    res.status(429).send(`Unhealthy. There are ${inFlightRequests}/${process.env.MAX_CONCURRENT_REQUESTS} requests in flight.`);
  }
});

// I don't GET it
app.get('/snap', (req, res) => {
  res.set('Allow', 'POST');
  return res.status(405).json({
    message: 'GET requests are not allowed. Use POST instead.',
  });
});

// Snaps
app.post('/snap', [
  body('html', '').optional(),
  query('url', 'Must be a valid URL with protocol and no auth').optional().isURL({ require_protocol: true, disallow_auth: true, validate_length: false }),
  query('width', 'Must be an integer with no units').optional().isInt(),
  query('height', 'Must be an integer with no units').optional().isInt(),
  query('scale', 'Must be an integer in the range: 1-3').optional().isInt({ min: 1, max: 3 }),
  query('media', 'Must be one of the following: print, screen').optional().isIn(['print', 'screen']),
  query('output', 'Must be one of the following: jpeg, jpg, png, webp, pdf (default)').optional().isIn(['jpeg', 'jpg','png', 'webp', 'pdf']),
  query('selector', `Must be a CSS selector made of the following characters: ${allowedSelectorChars}`).optional().isWhitelisted(allowedSelectorChars),
  query('pdfFormat', `Must be one of the following values: ${allowedFormats.join(', ')}`).optional().isIn(allowedFormats),
  query('pdfLandscape', 'Must be one of the following (case insensitive): true, false').optional().toLowerCase().isBoolean(),
  query('pdfBackground', 'Must be one of the following (case insensitive): true, false').optional().toLowerCase().isBoolean(),
  query('pdfMarginTop', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginRight', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginBottom', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginLeft', 'Must be a decimal with no units. Use pdfMarginUnit to set units.').optional().isNumeric(),
  query('pdfMarginUnit', `Must be one of the following values: ${allowedPdfMarginUnits.join(', ')}`).optional().isIn(allowedPdfMarginUnits),
  query('user', 'Must be an alphanumeric string').optional().isAlphanumeric(),
  query('pass', 'Must be an alphanumeric string').optional().isAlphanumeric(),
  query('logo', `Must be one of the following values: ${Object.keys(logos).join(', ')}. If you would like to use your site's logo with Snap Service, please read how to add it at https://github.com/UN-OCHA/tools-snap-service#custom-logos`).optional().isIn(Object.keys(logos)),
  query('service', 'Must be an alphanumeric string identifier (hyphens, underscores are also allowed).').matches(/^[A-Za-z0-9_-]+$/),
  query('ua', '').optional(),
  query('delay', 'Must be an integer between 0-10000 inclusive.').optional().isInt({ min: 0, max: 10000 }),
  query('debug', 'Must be one of the following (case insensitive): true, false').optional().toLowerCase().isBoolean(),
  query('block', 'Must be a comma-separated list of domains (alphanumeric, hyphens, dots, commas)').optional().matches(/^[A-Za-z0-9.,-]+$/),
], (req, res) => {
  // debug
  log.debug('Request received', { query: url.parse(req.url).query });

  // If neither `url` and `html` are present, return 400 requiring valid input.
  if (!req.query.url && !req.body.html) {
    return res.status(400).json({
      errors: [
        {
          location: 'query',
          param: 'url',
          value: undefined,
          status: 400,
          msg: 'You must supply either `url` as a querystring parameter, or `html` as a URL-encoded form field.',
        },
        {
          location: 'body',
          param: 'html',
          value: undefined,
          status: 400,
          msg: 'You must supply either `url` as a querystring parameter, or `html` as a URL-encoded form field.',
        },
      ],
    });
  }

  // If both `url` and `html` are present, return 400 requiring valid input.
  if (req.query.url && req.body.html) {
    return res.status(400).json({
      errors: [
        {
          location: 'query',
          param: 'url',
          value: req.query.url,
          status: 400,
          msg: 'You must supply either `url` as a querystring parameter, OR `html` as a URL-encoded form field, but not both.',
        },
        {
          location: 'body',
          param: 'html',
          value: req.body.html,
          status: 400,
          msg: 'You must supply either `url` as a querystring parameter, OR `html` as a URL-encoded form field, but not both.',
        },
      ],
    });
  }

  // Ensure a passed url is on the permitted list or includes a substring that
  // is on the permitted list.
  if (req.query.url) {
    let urlHash;

    try {
      urlHash = new URL(req.query.url);
    } catch (err) {
      return res.status(400).json({
        errors: [
          {
            location: 'query',
            param: 'url',
            value: req.query.url,
            status: 400,
            msg: `${req.query.url} is not a valid URL. Make sure the protocol is present. Example: https://example.com/path`,
          },
        ],
      });
    }

    // Check if any of the allowed hostnames are substrings of `url.hostname`
    // This allowed a domain suffix match as well as a full hostname match.
    if (!allowedHostnames.some((allowedHost) => urlHash.hostname.includes(allowedHost))) {
      return res.status(403).json({
        errors: [
          {
            location: 'query',
            param: 'url',
            value: urlHash.hostname,
            status: 403,
            msg: `${urlHash.hostname} does not match any allowed hostname. Please file an OPS ticket if you want to allow a new hostname.`,
          },
        ],
      });
    }
  }

  // Validate input errors, return 400 for any problems.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
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
  const fnFullPage = fnSelector === '';
  const fnLogo = req.query.logo || false;
  const fnService = req.query.service || '';
  const fnUserAgent = req.query.ua || req.headers['user-agent'] || '';
  const fnDelay = Number(req.query.delay) || 0;
  const fnDebug = Boolean(req.query.debug === 'true') || false;
  const fnBlock = req.query.block || '';

  // Declare options objects here so that multiple scopes have access to them.
  let imgOptions = {};
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

  async.series(
    [
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
            imgOptions = {
              path: tmpPath,
              fullPage: fnFullPage,
              type: fnOutput,
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
              const pdfLogoData = new Buffer.from(fs.readFileSync(pdfLogoFile, 'binary'));
              const pdfLogo = {
                src: `data:${mime.lookup(pdfLogoFile)};base64,${pdfLogoData.toString('base64')}`,
                // Dimensions reduced to 3/4 size because the PDF contents are
                // rendered at 96ppi but the header is 72ppi.
                width: imgSize(pdfLogoFile).width * 0.75,
                height: imgSize(pdfLogoFile).height * 0.75,
              };

              // Inject header with placeholder substitution for logos.
              pdfOptions.headerTemplate = fnPdfHeader
                .replace('__LOGO_SRC__', pdfLogo.src)
                .replace('__LOGO_WIDTH__', pdfLogo.width)
                .replace('__LOGO_HEIGHT__', pdfLogo.height);
            }
          } catch (err) {
            return cb(err);
          }

          await PUPPETEER_SEMAPHORE.use(async () => {
            // Access the Chromium instance by either launching or connecting
            // to Puppeteer.
            const browser = await connectPuppeteer().catch((err) => {
              throw err;
            });

            // Create a new browser context. As of Puppeteer 22.0.0 all new
            // browser contexts are isolated (cookies/localStorage/etc).
            // So they renamed the previous function name to remove the word
            // Incognito. It still offers the same isolation as before.
            //
            // @see https://github.com/puppeteer/puppeteer/releases/tag/puppeteer-core-v22.0.0
            // @see https://github.com/puppeteer/puppeteer/pull/11834/files
            const context = await browser.createBrowserContext();

            // Create a new tab/page within the context.
            const page = await context.newPage();

            try {
              // Set duration until Timeout
              await page.setDefaultNavigationTimeout(60 * 1000);

              // We want to intercept requests to dump logs or block domains.
              if (fnDebug || fnBlock) {
                await page.setRequestInterception(true);

                // Blocklist
                await page.on('request', (pageReq) => {
                  const blocklist = fnBlock.split(',');

                  let domain = null;
                  const frags = pageReq.url().split('/');
                  if (frags.length > 2) {
                    domain = frags[2];
                  }

                  // Block request if a blocklisted domain is found
                  if (fnBlock && blocklist.some((blocked) => domain.indexOf(blocked) !== -1)) {
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
                page.on('console', (msg) => {
                  const errText = msg._args
                    && msg._args[0]
                    && msg._args[0]._remoteObject
                    && msg._args[0]._remoteObject.value;
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

              // Compile cookies if present. We must manually specify some extra
              // info such as host/path in order to create a valid cookie.
              const cookies = [];
              if (fnCookies) {
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
              cookies.forEach(async (cookie) => {
                await page.setCookie(cookie).catch((err) => {
                  log.error(err);
                });
              });

              // Store the main http request result, so we can check for errors.
              let result;

              // We need to load the HTML differently depending on whether it's
              // HTML in the POST or a URL in the querystring.
              if (fnUrl) {
                result = await page.goto(fnUrl, {
                  waitUntil: ['load', 'networkidle0'],
                });
              } else {
                result = await page.goto(`data:text/html,${fnHtml}`, {
                  waitUntil: ['load', 'networkidle0'],
                });
              }

              // Throw an early error if the page load did not return OK.
              // We handle this later, so we can return a sensible response
              // to the user.
              if (!result.ok()) {
                const statusText = result.statusText() || `Upstream HTTP error ${result.status()}`;
                let error = new Error(statusText);
                error.code = result.status();
                error.upstream = true;
                throw error;
              }

              // Add a class indicating what type of Snap is happening. Sites
              // can use this class to apply customizations before the final
              // asset (PNG/PDF) is generated.
              //
              // Note: page.evaluate() is a stringified injection into the
              // runtime so any arguments you need inside this function block
              // have to be explicitly passed instead of relying on closure.
              await page.evaluate((snapOutput) => {
                document.documentElement.classList.add(`snap--${snapOutput}`);
              }, fnOutput);

              // Output PDF or JPG, PNG, WEBP image?
              if (fnOutput === 'pdf') {
                // If an artificial delay was specified, wait for it.
                if (fnDelay) {
                  await new Promise((r) => setTimeout(r, fnDelay));
                }

                await page.pdf(pdfOptions);
              } else {
                // Output whole document or DOM fragment?
                if (fnSelector) {
                  imgOptions.omitBackground = true;

                  // Make sure our selector is in the DOM.
                  await page.waitForSelector(fnSelector).then(async () => {
                    // Select the element from the DOM.
                    const fragment = await page.$(fnSelector).catch((err) => {
                      throw err;
                    });

                    // If an artificial delay was specified, wait for it.
                    if (fnDelay) {
                      await new Promise((r) => setTimeout(r, fnDelay));
                    }

                    // Finally, take the screenshot.
                    //
                    // NOTE: previous versions of Puppeteer had difficulties
                    // with PNG bounding boxes. We fixed it by switching to the
                    // method of clipping PNGs using fragment.boundingBox()
                    // then executing page.screenshot().
                    //
                    // After a few Chrome/Puppeteer upgrades, the problem came
                    // back in a slightly different form, again resolved by
                    // commenting the code back out and using the "convenience"
                    // method again: fragment.screenshot()
                    //
                    // It might be necessary to flip between these two methods
                    // from time to time so it's been left intact as a comment.
                    //
                    // @see https://humanitarian.atlassian.net/browse/SNAP-51
                    await fragment.screenshot(imgOptions);

                    // const elementBoundingBox = await fragment.boundingBox();
                    // imgOptions.clip = {
                    //   x: elementBoundingBox.x,
                    //   y: elementBoundingBox.y,
                    //   width: elementBoundingBox.width,
                    //   height: elementBoundingBox.height,
                    // };
                    // await page.screenshot(imgOptions);
                  }).catch((err) => {
                    throw err;
                  });
                } else {
                  // If an artificial delay was specified, wait for it.
                  if (fnDelay) {
                    await new Promise((r) => setTimeout(r, fnDelay));
                  }

                  // Finally, take the screenshot.
                  await page.screenshot(imgOptions);
                }
              }
            } catch (err) {
              log.error(err);
              throw err;
            } finally {
              // Disconnect from Puppeteer process.
              await context.close();
              await browser.disconnect();
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
          } else if (fnOutput === 'jpg' || fnOutput === 'jpeg') {
            res.contentType('image/jpeg');
            res.sendFile(tmpPath, () => {
              const duration = ((Date.now() - startTime) / 1000);
              res.end();
              lgParams.duration = duration;
              log.info(lgParams, `JPEG successfully generated in ${duration} seconds.`);
              return fs.unlink(tmpPath, cb);
            });
          } else if (fnOutput === 'webp') {
            res.contentType('image/webp');
            res.sendFile(tmpPath, () => {
              const duration = ((Date.now() - startTime) / 1000);
              res.end();
              lgParams.duration = duration;
              log.info(lgParams, `WEBP successfully generated in ${duration} seconds.`);
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
        }).catch((err) => cb(err));
      },
    ],
    (err) => {
      const duration = ((Date.now() - startTime) / 1000);

      if (err) {
        lgParams.fail = true;
        lgParams.stack_trace = err.stack;
        lgParams.duration = duration;
        log.error(lgParams, `Snap FAILED in ${duration} seconds. ${err}`);

        //
        // Detect known issues and send more appropriate error codes.
        //

        if (err.upstream) {
          return res.status(502).json({
            errors: [
              {
                location: 'query',
                param: 'url',
                value: req.query.url,
                status: err.code,
                msg: err.message,
              },
            ],
          });
        }

        // URL can't be reached.
        if (err.message.indexOf('ERR_NAME_NOT_RESOLVED') !== -1) {
          return res.status(400).json({
            errors: [
              {
                location: 'query',
                param: 'url',
                value: req.query.url,
                status: 400,
                msg: 'The URL could not be loaded. Confirm that it exists.',
              },
            ],
          });
        }

        // URL timed out, throw shade.
        if (err.message.indexOf('ERR_TIMED_OUT') !== -1 || err.name === 'TimeoutError') {
          return res.status(502).json({
            errors: [
              {
                status: 502,
                msg: 'Snap is working, but the target URL timed out.',
              },
            ],
          });
        }

        //
        // Default
        //
        // If we didn't detect a specific error above, send a generic 500.
        //
        res.status(500).json({
          errors: [
            {
              status: 500,
              msg: 'Internal Server Error',
            },
          ],
        });
      }
    },
  );
});

http.createServer(app).listen(app.get('port'), () => {
  log.info('⚡️ Express server configured for', (process.env.MAX_CONCURRENT_REQUESTS || 4), 'concurrent requests listening on port:', app.get('port'));
});
