const {exec, execSync} = require('child_process');
const {series} = require('gulp');

const PREFIX = 'amp-dev';
// We tag docker images by the current git commit SHA,
// this makes it easy to identify and reproduce builds.
const TAG = execSync('git log -1 --pretty=%H');
// The default Google Cloud project id
const PROJECT_ID = 'amp-dev-230314';
const DEFAULT_REGION = 'us-east1';
const DEFAULT_ZONE = 'us-east1-c';

const config = {
  prefix: PREFIX,
  tag: TAG,
  instance: {
    group: `ig-${PREFIX}`,
    template: `it-${PREFIX}-${TAG}`,
    count: 2,
  },
  gcloud: {
    project: PROJECT_ID,
    region: DEFAULT_REGION,
    zone: DEFAULT_ZONE,
  },
  image: {
    name: `gcr.io/${PROJECT_ID}/${PREFIX}`,
    current: `gcr.io/${PROJECT_ID}/${PREFIX}:${TAG}`,
  },
};

/**
 * Initialize the Google Cloud project.
 * Needs to be only run once.
 */
function cloudInit(cb) {
  [
    'gcloud auth configure-docker',
    `gcloud config set compute/region ${config.gcloud.region}`,
    `gcloud config set compute/zone ${config.gcloud.zone}`,
  ].forEach(execSync);
  cb();
}

/**
 * Builds a local docker image for testing.
 */
function imageBuild() {
  return run(`docker build --tag ${config.image.current} .`);
}

/**
 * Builds and uploads a docker image to Google Cloud Container Registry.
 */
function imageUpload() {
  return run(`gcloud builds submit --tag ${config.image.current} .`);
}

/**
 * Lists all existing images in the Google Cloud Container Registry.
 */
function imageList() {
  return run(`gcloud container images list-tags ${config.image.name}`);
}

/**
 * Create a new VM instance template based on the latest docker image.
 */
function instanceTemplateCreate() {
  return run(`gcloud compute instance-templates create-with-container ${config.instance.template} \
     --container-image ${config.image.current} \
     --tags http-server,https-server`);
}

/**
 * Start a rolling update to a new VM instance template. This will ensure
 * that there's always at least 1 active instance running during the update.
 */
function updateStart() {
  return run(`gcloud beta compute instance-groups managed rolling-action \
     start-update ${config.instance.group} \
     --version template=${config.instance.template} \
     --min-ready 1m \
     --max-surge 1 \
     --max-unavailable 1`);
}

/**
 * Start a rolling update to a new VM instance template. This will ensure
 * that there's always at least 1 active instance running during the update.
 */
function updateStatus() {
  return run(
      `gcloud beta compute instance-groups managed describe ${config.instance.group} \
          --zone=${ZONE}`,
      'Rolling update started, this can take a few minutes...\n\n' +
          'Run `gulp updateStatus` to check the process (`stable => true`).'
  );
}

/**
 * Stops a rolling update to a new VM instance template. This will only work
 * while there's a rolling update active initiated by updateStart. This will
 * **not** revert already updated instances. Instead, this command should be
 * followed by another call to updateStart to ensure that all instances use
 * the same instance template.
 */
function updateStop() {
  return run(`gcloud compute instance-groups managed rolling-action \
    stop-proactive-update ${config.instance.group}`);
}

function run(command, message) {
  return exec(command, {
    stdio: 'inherit',
    cwd: __dirname,
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(stdout);
    console.log(stderr);
    if (message) {
      console.log('\n', message);
    }
  });
}

exports.cloudInit = cloudInit;
exports.deploy = series(imageUpload, instanceTemplateCreate, updateStart);
exports.imageList = imageList;
exports.imageUpload = imageUpload;
exports.imageBuild = imageBuild;
exports.updateStop = updateStop;
exports.updateStatus = updateStatus;
exports.updateStart = updateStart;

