const express = require('express');
const bodyParser = require('body-parser');
const { BayesClassifier, PorterStemmerRu } = require('natural');
const db = require('./src/db');
require('dotenv').config();

const app = express();
const ReasonsClassifier = new BayesClassifier(PorterStemmerRu);

app.use(bodyParser.urlencoded({ extended: true }));

app.get('/reasons/list', async (req, res) => {
  await db.query('SELECT `reasons`.`name` FROM `reasons`').then(async reasons => {
    res.status(200).json(reasons[0].map(r => r.name));
    // res.status(200).json(NewReasons.map(r => r[0]))//.toArray()
  });
});

app.post('/reasons', async (req, res) => {
  await InitReasons(res);
});

app.post('/learn', (req, res) => {
  Learn(res);
});

app.post('/', async (req, res) => {
  if (req.body.message == null) {
    res.end('Need `message` parameter.');
    return;
  } else if (typeof req.body.message != 'string' || req.body.message.length < 3) {
    res.end('Need message with `string` type and length more than 3 symbols.');
    return;
  }

  await Get(req.body.message, res);
});

app.listen(process.env.APP_PORT, process.env.APP_HOST, () => {
  console.log(`Reason determiner is running`);
  Learn(null);
});

// https://medium.com/devschacht/natural-language-processing-for-node-js-da990c7dd886

async function Learn(res) {
  await db.query('SELECT `reasons`.`id` FROM `reasons` WHERE `id` != 1').then(async ids => {
    let first_id_chunk = [];

    for (const id of ids[0]) {
      const count = 50;
      const query = 'SELECT `reasons`.`id` AS label, `messages`.`content` AS text ' +
        'FROM `resolved_tickets` JOIN `reasons` ON `reasons`.`id` = `resolved_tickets`.`reason_id` ' +
        'JOIN `messages` ON `messages`.`ticket_id` = `resolved_tickets`.`old_ticket_id` ' +
        'WHERE LOWER(`messages`.`content`) NOT LIKE LOWER("%тест%") ' +
        `AND reasons.id IN (${id.id.toString()}) ` +
        'AND `messages`.`id` IN (SELECT MIN(m2.id) FROM messages as m2 join resolved_tickets as t2 on t2.old_ticket_id = m2.ticket_id GROUP BY t2.old_ticket_id) ' +
        'GROUP BY `resolved_tickets`.`old_ticket_id`, `messages`.`id` ' +
        'ORDER BY reasons.id DESC LIMIT ' + count;

      await db.query(query).then(d => {
        const chunk = d[0];
        let new_chunk = [...chunk];
        const l = chunk.length;

        if (l < 20) {
          chunk.forEach(c => first_id_chunk.push(c));
          return;
        } else if (l < count) {
          for (let i = l; i < count; i++) {
            const element = chunk[i % l];
            new_chunk.push(element);
          }
        }
        console.log(`new_chunk.length(${id.id})=${chunk.length}->${new_chunk.length}`);

        new_chunk.forEach(item => {
          if (item == null) return;
          const text = item.text.replace(/(https?:\/\/[А-яA-z0-9 ._-]+\/([A-z0-9 ._-]+\/)+(\?id=\d+)?)/g, '');
          ReasonsClassifier.addDocument(text, item.label);
          // ReasonsClassifier.addDocument(item.text, '1')
        });
      }).catch(console.error);
    }

    console.log(first_id_chunk.length);
    console.log(first_id_chunk[0].label);
    first_id_chunk.forEach(c => {
      const text = c.text.replace(/(https?:\/\/[А-яA-z0-9 ._-]+\/([A-z0-9 ._-]+\/)+(\?id=\d+)?)/g, '');
      ReasonsClassifier.addDocument(text, 1);
    });

    ReasonsClassifier.train();
  }).catch(console.error);

  if (res == null) {
    console.log({ status: true });
  } else {
    res.status(200).json({ status: true });
  }
}

async function Get(message, res) {
  const classification = ReasonsClassifier.getClassifications(message);
  console.log(classification);
  if (classification == [] || classification == null || classification[0] == null || classification[0].value < 1e-12) {
    res.status(200).json('Неопределённая тема');
    return;
  }

  const text = message.replace(/(https?:\/\/[А-яA-z0-9 ._-]+\/([A-z0-9 ._-]+\/)+(\?id=\d+)?)/g, '');
  const result = ReasonsClassifier.classify(text);
  await db.query('SELECT `reasons`.`name` FROM `reasons` WHERE `reasons`.`id` = ' + result + ' LIMIT 1').then(async data => {
    res.status(200).json(data[0][0].name);
  });
}
