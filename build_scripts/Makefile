PREFIX              := amp-dev
TAG                 := $(shell git log -1 --pretty=%H)
INSTANCE_GROUP      := ig-${PREFIX}
INSTANCE_TEMPLATE   := it-${PREFIX}-${TAG}
INSTANCE_GROUP_SIZE := 2
PROJECT_ID          := amp-dev-230314
WORKING_DIR         := ..
HEALTH_CHECK        := http-basic-check

REGION						  := us-east1
ZONE								:= us-east1-c

IMAGE_PREFIX        := gcr.io/${PROJECT_ID}/${PREFIX}
IMAGE_TAG           := ${IMAGE_PREFIX}:${TAG}

init-docker:
	gcloud auth configure-docker
	-gcloud config set compute/region ${REGION}
	-gcloud config set compute/zone ${ZONE}

docker-build:
	cd ${WORKING_DIR} && docker build --tag ${IMAGE_TAG} .

docker-upload:
	 cd ${WORKING_DIR} && gcloud builds submit --tag ${IMAGE_TAG} .

list-images:
	gcloud container images list-tags ${IMAGE_PREFIX}

create-instance-template:
	 gcloud compute instance-templates create-with-container ${INSTANCE_TEMPLATE} --container-image ${IMAGE_TAG} \
		 --tags http-server,https-server

update:
	gcloud beta compute instance-groups managed rolling-action start-update ${INSTANCE_GROUP} \
	 --version template=${INSTANCE_TEMPLATE} \
	 --min-ready 1m \
	 --max-surge 1 \
	 --max-unavailable 1

update-status:
	gcloud beta compute instance-groups managed describe ${INSTANCE_GROUP} \
		--zone=${ZONE}

update-stop:
	gcloud compute instance-groups managed rolling-action stop-proactive-update ${INSTANCE_GROUP}

deploy: docker-upload create-instance-template update

