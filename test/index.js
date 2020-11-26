/**
 * index lib tests
 *
 * see README/tests for directives
 */
const { join } = require('path');
const S3 = require('aws-sdk/clients/s3');
const { expect } = require('./Common');
const {
  getObjectContent,
  getObjectHash,
  listKeys,
  upload,
  uploadFile,
  uploadDirectory,
} = require('../lib');

// S3 conf
const s3 = new S3({
  signatureVersion: 'v4',
});

// setup
// bucket
const bucket = process.env.AWS_BUCKET;

// files on S3 (to adapt)
const js = 'index.js';
const json = 'manifest.json';
const txt = 'robots.txt';
const favicon = 'favicon.ico';
const unknown = 'unknown/key.js';

// object content to be uploaded
const object = {
  key: 'upload_test.json',
  body: '{"upload":"test"}',
  contentType: 'application/json',
};

// local dir and file to upload
const toupload = {
  dir: {
    path: join(__dirname, './toupload'),
    files: ['a.txt', 'b.js', 'sub/c.html', 'sub/subsub/d.md', 'sub/subsub/e.json'],
    filesRootKey: [],
    rootKey: 'public/test',
  },
  file: {
    path: join(__dirname, './toupload/b.js'),
    key: 'b.js',
    body: 'const b = \'this is b\';\n',
    contentType: 'application/javascript',
  },
  unknownDirPath: 'unknown_dir',
  unknownFilePath: 'unknown_file.js',
};

// add rootKey to each dir file
toupload.dir.files.forEach((file) => {
  toupload.dir.filesRootKey.push(join(toupload.dir.rootKey, file));
});

describe('#index', function() {
  // getObjectContent
  context('when using getObjectContent', function() {
    it('should throw an error if there is no bucket and key in params', async function() {
      let error;

      try {
        await getObjectContent();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should throw an error if the key is unknown', async function() {
      let error;

      try {
        await getObjectContent({
          Key: unknown,
          Bucket: bucket,
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_NO_SUCH_KEY');
    }).timeout(5000);

    it('should return a buffer if requesting a js file', async function() {
      let content;

      try {
        content = await getObjectContent({
          Key: js,
          Bucket: bucket,
        });
      } catch (e) {}

      expect(content).to.be.instanceof(Buffer);
    }).timeout(5000);

    it('should return an object if requesting a json file', async function() {
      let content;

      try {
        content = await getObjectContent({
          Key: json,
          Bucket: bucket,
        });
      } catch (e) {}

      expect(content).to.be.an('object');
    }).timeout(5000);

    it('should return a string if requesting a txt file', async function() {
      let content;

      try {
        content = await getObjectContent({
          Key: txt,
          Bucket: bucket,
        });
      } catch (e) {}

      expect(content).to.be.a('string');
    }).timeout(5000);

    it('should return a buffer if requesting a file with Content-Type different from application/json and text/...', async function() {
      let content;

      try {
        content = await getObjectContent({
          Key: favicon,
          Bucket: bucket,
        });
      } catch (e) {}

      expect(content).to.be.instanceof(Buffer);
    }).timeout(5000);
  });

  // getObjectHash
  context('when using getObjectHash', function() {
    it('should throw an error if there is no bucket and key in params', async function() {
      let error;

      try {
        await getObjectHash();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should throw an error if the key is unknown', async function() {
      let error;

      try {
        await getObjectHash({
          Key: unknown,
          Bucket: bucket,
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_NO_SUCH_KEY');
    }).timeout(5000);

    it('should return a string with the object\'s content hash', async function() {
      let a;
      let b;

      try {
        a = await getObjectHash({
          Key: js,
          Bucket: bucket,
        });

        b = await getObjectHash({
          Key: js,
          Bucket: bucket,
        });
      } catch (e) {}

      expect(a).to.be.a('string');
      expect(b).to.be.a('string');
      expect(a).to.equals(b);
    }).timeout(5000);
  });

  // listKeys
  context('when using listKeys', function() {
    it('should throw an error if there is no bucket in params', async function() {
      let error;

      try {
        await listKeys();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should return an empty array when ignoring all keys', async function() {
      let list;

      try {
        list = await listKeys({
          Bucket: bucket,
        },{
          ignoreRegExp: /.*/,
        });
      } catch (e) {}

      expect(list).to.be.an('array').and.to.be.empty;
    }).timeout(5000);

    it('should return an array without the specified key(s)', async function() {
      let list;

      try {
        list = await listKeys({
          Bucket: bucket,
        },{
          ignoreKeys: [js, json]
        });
      } catch (e) {}

      expect(list).to.be.an('array').that.not.includes(js, json);
    }).timeout(5000);

    it('should return an array without the specified keys when using both a regexp and an array of objects to ignore', async function() {
      let list;

      try {
        list = await listKeys({
          Bucket: bucket,
        },{
          ignoreKeys: [js],
          ignoreRegExp: new RegExp(json),
        });
      } catch (e) {}

      expect(list).to.be.an('array').that.not.includes(js, json);
    }).timeout(5000);

    it('should return an array with keys not starting with a slash if option is false or undefined', async function() {
      let list1;
      let list2;

      try {
        list1 = await listKeys({
          Bucket: bucket,
        });

        list2 = await listKeys({
          Bucket: bucket,
        },{
          startSlash: false,
        });
      } catch (e) {}

      expect(list1).to.be.an('array');

      list1.forEach((key) => {
        expect(key).to.be.a('string');
        expect(key.startsWith('/')).to.be.false;
      });

      expect(list2).to.be.an('array');

      list2.forEach((key) => {
        expect(key).to.be.a('string');
        expect(key.startsWith('/')).to.be.false;
      });
    }).timeout(5000);

    it('should return an array with keys starting with a slash if option is true', async function() {
      let list;

      try {
        list = await listKeys({
          Bucket: bucket,
        },{
          startSlash: true,
        });
      } catch (e) {}

      expect(list).to.be.an('array');

      list.forEach((key) => {
        expect(key).to.be.a('string');
        expect(key.startsWith('/')).to.be.true;
      });
    }).timeout(5000);
  });

  // upload
  context('when using upload', function() {
    it('should throw an error if there is no bucket, key or body in params', async function() {
      let error;

      try {
        await upload();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should upload the file content to s3 and return true', async function() {
      let uploaded;
      let error;

      try {
        uploaded = await upload({
          Key: object.key,
          Bucket: bucket,
          Body: object.body
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.undefined;
      expect(uploaded).to.be.true;

      // check object in s3
      let s3object;

      try {
        s3object = await s3.getObject({
          Key: object.key,
          Bucket: bucket,
        }).promise();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.undefined;
      expect(s3object).to.be.an('object');
      expect(s3object.Body.toString('utf8')).equals(object.body);
      expect(s3object.ContentType).equals(object.contentType);
    }).timeout(5000);
  });

  // uploadFile
  context('when using uploadFile', function() {
    it('should throw an error if there is no path', async function() {
      let error;

      try {
        await uploadFile({
          params: {
            Key: toupload.file.key,
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should throw an error if file does not exist', async function() {
      let error;

      try {
        await uploadFile({
          path: toupload.unknownFilePath,
          params: {
            Key: toupload.file.key,
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should throw an error if there is no bucket, key or body in params', async function() {
      let error;

      try {
        await uploadFile({ path: toupload.file.path });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should upload the file to s3 and return true', async function() {
      let uploaded;
      let error;

      try {
        uploaded = await uploadFile({
          path: toupload.file.path,
          params: {
            Key: toupload.file.key,
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.undefined;
      expect(uploaded).to.be.true;

      // check object in s3
      let s3object;

      try {
        s3object = await s3.getObject({
          Key: toupload.file.key,
          Bucket: bucket,
        }).promise();
      } catch (e) {
        error = e;
      }

      expect(error).to.be.undefined;
      expect(s3object).to.be.an('object');
      expect(s3object.Body.toString('utf8')).to.equals(toupload.file.body);
      expect(s3object.ContentType).equals(toupload.file.contentType);
    }).timeout(5000);
  });

  // uploadDirectory
  context('when using uploadDirectory', function() {
    it('should throw an error if there is no dir path', async function() {
      let error;

      try {
        await uploadDirectory({
          params: {
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'FS_ERROR');
    });

    it('should throw an error if dir does not exist', async function() {
      let error;

      try {
        await uploadDirectory({
          path: toupload.unknownDirPath,
          params: {
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'FS_ERROR');
    });

    it('should throw an error if not a directory', async function() {
      let error;

      try {
        await uploadDirectory({
          path: toupload.file.path,
          params: {
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'FS_ERROR');
    });

    it('should throw an error if there is no bucket in params', async function() {
      let error;

      try {
        await uploadDirectory({ path: toupload.dir.path });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.an('error').with.property('code', 'AWS_ERROR');
    });

    it('should upload the directory to s3 recursively at bucket root and return true', async function() {
      let uploaded;
      let error;

      try {
        uploaded = await uploadDirectory({
          path: toupload.dir.path,
          params: {
            Bucket: bucket,
          },
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.undefined;
      expect(uploaded).to.be.true;

      // check object in s3
      let list;

      try {
        list = await listKeys({
          Bucket: bucket,
        });
      } catch (e) {}

      expect(error).to.be.undefined;
      expect(list).to.be.an('array').that.includes(...toupload.dir.files);
    }).timeout(5000);

    it('should upload the directory to s3 recursively at a specified root and return true', async function() {
      let uploaded;
      let error;

      try {
        uploaded = await uploadDirectory({
          path: toupload.dir.path,
          params: {
            Bucket: bucket,
          },
          rootKey: toupload.dir.rootKey,
        });
      } catch (e) {
        error = e;
      }

      expect(error).to.be.undefined;
      expect(uploaded).to.be.true;

      // check object in s3
      let list;

      try {
        list = await listKeys({
          Bucket: bucket,
        });
      } catch (e) {}

      expect(error).to.be.undefined;
      expect(list).to.be.an('array').that.includes(...toupload.dir.filesRootKey);
    }).timeout(5000);
  });
});
