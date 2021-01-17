#!/bin/bash
VERSION_ENGINE_SERVER=`cat ../dendron/meta.json | jq -r '.["@dendronhq/engine-server"]'`
VERSION_COMMON_ALL=`cat ../dendron/meta.json | jq -r '.["@dendronhq/common-all"]'`

yarn unlink @dendronhq/common-all
yarn unlink @dendronhq/engine-server

yarn add --force  @dendronhq/common-all@$VERSION_COMMON_ALL
yarn add --force  @dendronhq/engine-server@$VERSION_ENGINE_SERVER