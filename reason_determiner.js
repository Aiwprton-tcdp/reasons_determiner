const http = require('http')
const express = require('express')
const bodyParser = require('body-parser')
const { BayesClassifier, LogisticRegressionClassifier, PorterStemmerRu } = require('natural')
const { GetData } = require('./src/data')
const db = require('./src/db')
require('dotenv').config()

const app = express()
const port = 3052
const host = 'reasons_determiner.node.sms19.ru'
const ReasonsClassifier = new BayesClassifier(PorterStemmerRu)
const OldReasons = {
  2: 'Запрос лидов',
  11: 'Проблема с принтером',
  12: 'Долго грузит',
  13: 'Пропадает доступ в интернет',
  19: 'Объединение',
  20: 'Выбор телефонной линий',
  21: 'Отклики',
  23: 'КЦ',
  28: 'Нет отдела',
  29: 'Не отправляется сообщение',
  43: 'Проблема с гарнитурой',
  44: 'Проблема с монитором (экраном)',
  57: 'Личный кабинет (Не открытая линия)',
  65: 'Не включается компьютер',
  67: 'Партнёрская программа',
  68: 'Клиент не запущен',
  82: 'Заказ техники: ноутбук',
  83: 'Заказ техники: гарнитура',
  93: 'Нет доступа к Интернету через Wi-Fi',
  104: 'Нет доступа к общему диску офиса',
  105: 'Плохо слышно при звонке',
  138: 'Настройка стационарного телефона',
  139: 'Не удается совершить звонок в Битрикс',
  140: 'Редактирование сущности',
  141: 'Удаление тестовых сущностей',
  142: 'Снятие невидимых просроченных задач',
  143: 'Нет доступа к сущности',
  144: 'Не работает бизнес-процесс',
  146: 'Сделка не уходит в успех'
}
const NewReasons = [
  ['Неопределённая тема', [1]],
  ['Настройка стационарного телефона', [138]],
  ['Не удается совершить звонок в Битрикс', [139]],
  ['Редактирование сущности', [140]],
  // ['Объединение сущностей', [19,114]],
  ['Удаление тестовых сущностей', [141]],
  ['Снятие невидимых просроченных задач', [142]],
  ['Нет доступа к сущности', [143]],
  ['Не работает бизнес-процесс', [144]],
  ['Сделка не уходит в успех', [146]],
  ['Распределение сущностей по отделу', [147]],
  ['Долго грузит', [12]],
  ['Пропадает доступ в интернет', [13]],
  ['Не включается компьютер', [65]],
  ['Партнёрская программа', [67]],
  ['Нет доступа к общему диску офиса', [104]],
  ['Плохо слышно при звонке', [105]],
  ['Отклики', [21]],
  ['КЦ', [23]],
  ['Личный кабинет', [57]],
  ['Проблема с периферией', [9,10,43,44]],
  ['Проблема с принтером', [11]],
  ['Запрос лидов', [2]],
  ['Заказ техники', [72,82,83,84,85,86,87,88,89,90,91,92]],
  ['Заказ мебели', [/*71,*/73,74,75,76,77,78,79,80,81,95]],
  ['Нет доступа к Интернету через Wi-Fi', [93]],

  ['Не создаётся договор', [145]],
  ['Открытая линия (WhatsApp)', [68,100]],
  ['Добавить телефонную линию ОП', [113]],
  ['Проблема с открытой линией', [27,28,29]],
  ['Автообзвон', [60,61,62,101]],
  // ['Увольнение/перемещение сотрудника', [96,97,98]],
  ['Электронная почта', [99]],
  // ['Остановить рекламу', [102]],
  ['Репутация', [110]],
  ['Не считывается USB устройство на телевизоре', [111,112]],
  // ['Полиграфия', [117,118,119,120,121,122,123,124,125]],
  // ['Оформление', [126,127,128,129,130]],
  // ['Наружная реклама', [/*131,132,133,134,135,*/136]],
  ['Не работает настенная карта', [137]],
]

app.use(bodyParser.urlencoded({ extended: true }))

app.get('/reasons/list', (req, res) => {
  res.status(200).json(NewReasons.map(r => r[0]))//.toArray()
})

app.post('/reasons', async (req, res) => {
  await InitReasons(res)
})

app.post('/learn', (req, res) => {
  Learn(res)
})

app.post('/', async (req, res) => {
  if (req.body.message == null) {
    res.end('Need `content` parameter.')
    return
  } else if (typeof req.body.message != 'string' || req.body.message.length < 3) {
    res.end('Need message with `string` type and length more than 3 symbols.')
    return
  }

  await Get(req.body.message, res)
})

app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`)
  Learn(null)
})

// https://medium.com/devschacht/natural-language-processing-for-node-js-da990c7dd886

async function InitReasons(res) {
  // let ids = []
  // NewReasons.forEach(r => ids.concat(r[1]))
  let ids = NewReasons.map(r => r[1]).flat().toString()
  console.log(ids)
  // res.status(200).json(ids)
  // return

  // const query = 'SELECT `reasons`.`id`, `reasons`.`name` FROM `reasons` ' +
  // 'WHERE `reasons`.`id` IN (2,11,12,13,19,20,21,23,27,28,29,39,43,44,57,65,67,68,  72,73,74,75,76,77,78,79,80,81  ,82,83,85,87,89,91,93,99,104,105,138,139,140,142,143,144,146,147)'
  const query = 'SELECT reasons.id, reasons.name FROM tickets ' +
  'JOIN reasons ON reasons.id = tickets.reason_id ' +
  'JOIN messages ON messages.ticket_id = tickets.id ' +
  'WHERE LOWER(messages.message) NOT LIKE '%тест%' ' +
  'AND messages.id IN (SELECT MIN(m2.id) FROM messages m2 JOIN tickets t2 ON t2.id = m2.ticket_id GROUP BY t2.id) ' +
  // 'AND reasons.id IN (SELECT reasons.id FROM reasons JOIN tickets ON reasons.id = tickets.reason_id GROUP BY reasons.id HAVING COUNT(tickets.id) >= 50 ORDER BY reasons.id) ' +
  `AND reasons.id IN (${ids}) ` +
  'GROUP BY tickets.id, messages.id ' +
  'ORDER BY reasons.id ASC'
  
  await db.query(query).then(data => {
    const map = new Map()
    data[0].forEach(d => {
      map.set(d.id, d.name)
    })
    res.status(200).json({ data: Object.fromEntries(map) })
  }).catch(console.error)
}

async function Learn(res) {
// console.log(NewReasons)
  let ids = NewReasons.map(r => r[1])
  // console.log(ids)
  // return

  for (const id of ids) {
    const query = 'SELECT `reasons`.`id` AS label, `messages`.`message` AS text ' +
    'FROM `tickets` JOIN `reasons` ON `reasons`.`id` = `tickets`.`reason_id` ' +
    'JOIN `messages` ON `messages`.`ticket_id` = `tickets`.`id` ' +
    'WHERE LOWER(`messages`.`message`) NOT LIKE LOWER("%тест%") ' +
    `AND reasons.id IN (${id.toString()}) ` +
    'AND `messages`.`id` IN (SELECT MIN(m2.id) FROM messages as m2 join tickets as t2 on t2.id = m2.ticket_id GROUP BY t2.id) ' +
    'GROUP BY `tickets`.`id`, `messages`.`id` ' +
    'ORDER BY reasons.id DESC LIMIT 50'
    // 'HAVING COUNT(tickets.id) >= 50 ORDER BY reasons.id'
    
    await db.query(query).then(d => {
      d[0].forEach(item => {
        ReasonsClassifier.addDocument(item.text, item.label)
        // ReasonsClassifier.addDocument(item.text, '1')
      })
    }).catch(console.error)
  }

  
    for (let i = 0; i < 1000; i++) {
      ReasonsClassifier.addDocument('Неопределённая тема', '1')
    }
  ReasonsClassifier.train()
  
  if (res == null) {
    console.log({ status: true })
  } else {
    res.status(200).json({ status: true })
  }

  // await db.query(query).then(async d => {
  //   d[0].forEach(item => {
  //     ReasonsClassifier.addDocument(item.text, item.label)
  //     // ReasonsClassifier.addDocument(item.text, '1')
  //   })
  //   for (let i = 0; i < 1000; i++) {
  //     ReasonsClassifier.addDocument('Неопределённая тема', '1')
  //   }
  //   ReasonsClassifier.train()
  
  //   if (res == null) {
  //     console.log({ status: true })
  //   } else {
  //     res.status(200).json({ status: true })
  //   }
  // }).catch(console.error)
}

// async function Learn(res) {
//   // console.log(NewReasons)
//   let ids = NewReasons.map(r => r[1]).flat().toString()
//   // console.log(ids)
//   // return

//   const query = 'SELECT `reasons`.`id` AS label, `messages`.`message` AS text ' +
//   'FROM `tickets` JOIN `reasons` ON `reasons`.`id` = `tickets`.`reason_id` ' +
//   'JOIN `messages` ON `messages`.`ticket_id` = `tickets`.`id` ' +
//   'WHERE LOWER(`messages`.`message`) NOT LIKE LOWER("%тест%") ' +
//   // 'AND `reasons`.`id` IN (2,9,10,11,12,13,19,20,21,23,27,28,29,39,43,44,57,65,67,68,82,83,85,87,89,91,93,99,104,105,138,139,140,142,143,144,146,147) ' +
//   `AND reasons.id IN (${ids}) ` +
//   'AND `messages`.`id` IN (SELECT MIN(m2.id) FROM messages as m2 join tickets as t2 on t2.id = m2.ticket_id GROUP BY t2.id) GROUP BY `tickets`.`id`, `messages`.`id`'
  
//   await db.query(query).then(async d => {
//     d[0].forEach(item => {
//       ReasonsClassifier.addDocument(item.text, item.label)
//       // ReasonsClassifier.addDocument(item.text, '1')
//     })
//     for (let i = 0; i < 1000; i++) {
//       ReasonsClassifier.addDocument('Неопределённая тема', '1')
//     }
//     ReasonsClassifier.train()
  
//     if (res == null) {
//       console.log({ status: true })
//     } else {
//       res.status(200).json({ status: true })
//     }
//   }).catch(console.error)
// }

async function Get(message, res) {
  console.log(ReasonsClassifier.getClassifications(message))
  // const result = ReasonsClassifier.getClassifications(message)
  // res.status(200).json(result)
  // return
  const result = ReasonsClassifier.classify(message)
  let reason = NewReasons.find(r => r[1].includes(result*1))
  res.status(200).json(reason[0])
  return

  // const query0 = 'SELECT `reasons`.`name` AS label, `reasons`.`keywords` AS text FROM `reasons` WHERE `reasons`.`isDeleted` = 0 ' +
  //   'AND `reasons`.`id` IN (2,9,10,11,12,13,19,20,21,22,23,27,28,29,43,44,57,65,67,68,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,95,99,102,103,104,105,106,112,113,115,119,120,121,122,123,124,125,127,128,130,133,134,135,137,138,139,140,141,142,143,144,145,146,147,148,150,151,152)'

  // db.query(query0).then(d0 => {
  //   d0[0].forEach(item => {
  //     console.log(item.text + ' -- ' + item.label)
  //   })
  // })
  // return

  // Возможно нужные темы
  // ,9(24),10(25),22,84,86,88,90,102,103,106,112,113,141

  // Возможно ненужные темы
  // 73,74,75,76,77,78,79,80,81,95, 115,118,119,120,121,122,123,124,125,127,128,129,130,132,133,134,135,136,137,  148,150,151,152,

  // ,145 - дубликат 39

  const query = 'SELECT `reasons`.`name` AS label, `messages`.`message` AS text ' +
  'FROM `tickets` JOIN `reasons` ON `reasons`.`id` = `tickets`.`reason_id` ' +
  'JOIN `messages` ON `messages`.`ticket_id` = `tickets`.`id` ' +
  'WHERE LOWER(`messages`.`message`) NOT LIKE LOWER("%тест%") ' +
  'AND `reasons`.`id` IN (2,11,12,13,19,20,21,23,27,28,29,39,43,44,57,65,67,68,82,83,85,87,89,91,93,99,104,105,138,139,140,142,143,144,146,147) ' +
  'AND `messages`.`id` IN (SELECT MIN(m2.id) FROM messages as m2 join tickets as t2 on t2.id = m2.ticket_id GROUP BY t2.id) GROUP BY `tickets`.`id`, `messages`.`id`'
  
  await db.query(query/* + ' LIMIT 15000 OFFSET 5000'*/).then(async d => {
    const reasons = new BayesClassifier(PorterStemmerRu)
    // const query0 = 'SELECT `reasons`.`name`, `reasons`.`keywords` FROM `reasons` WHERE `reasons`.`isDeleted` = 0 ' +
    // 'AND `reasons`.`id` IN (2,9,10,11,12,13,19,20,21,22,23,27,28,29,43,44,57,65,67,68,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,95,99,102,103,104,105,106,112,113,115,119,120,121,122,123,124,125,127,128,130,133,134,135,137,138,139,140,141,142,143,144,145,146,147,148,150,151,152)'

    // await db.query(query0).then(async d0 => {
      // console.log(d0)
      // d0[0].forEach(i => d[0].push(i))
      // return

      d[0].forEach(item => {
        reasons.addDocument(item.text, item.label)
      })
      reasons.train()
    
      // console.log('-- ' + message)
      const result = reasons.classify(message)
      res.status(200).end(result)
    // }).catch(console.error)
  }).catch(console.error)
  

  // let data = GetData()
  // // GetData().then(d => {
  //   // console.log(typeof data)
  //   console.log(data)
  
  //   const reasons = new BayesClassifier(PorterStemmerRu)
  
  //   data.forEach(item => reasons.addDocument(item.text, item.label))
  //   reasons.train()
  
  //   let text = 'В офис нужен новый стол и шкаф'
  //   console.log(reasons.classify(text))
  // // })
}

// async function Get(message, res) {
//   // const query0 = 'SELECT `reasons`.`name` AS label, `reasons`.`keywords` AS text FROM `reasons` WHERE `reasons`.`isDeleted` = 0 ' +
//   //   'AND `reasons`.`id` IN (2,9,10,11,12,13,19,20,21,22,23,27,28,29,43,44,57,65,67,68,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,95,99,102,103,104,105,106,112,113,115,119,120,121,122,123,124,125,127,128,130,133,134,135,137,138,139,140,141,142,143,144,145,146,147,148,150,151,152)'

//   // db.query(query0).then(d0 => {
//   //   d0[0].forEach(item => {
//   //     console.log(item.text + ' -- ' + item.label)
//   //   })
//   // })
//   // return

//   // Возможно нужные темы
//   // ,22,84,86,88,90,102,103,106,112,113,141

//   // Возможно ненужные темы
//   // 73,74,75,76,77,78,79,80,81,95, 115,118,119,120,121,122,123,124,125,127,128,129,130,132,133,134,135,136,137,  148,150,151,152,

//   // ,145 - дубликат 39

//   const query = 'SELECT `reasons`.`name` AS label, `messages`.`message` AS text ' +
//   'FROM `tickets` JOIN `reasons` ON `reasons`.`id` = `tickets`.`reason_id` ' +
//   'JOIN `messages` ON `messages`.`ticket_id` = `tickets`.`id` ' +
//   'WHERE LOWER(`messages`.`message`) NOT LIKE LOWER('%тест%') ' +
//   'AND `reasons`.`id` IN (2,9,10,11,12,13,19,20,21,23,27,28,29,39,43,44,57,65,67,68,82,83,85,87,89,91,93,99,104,105,138,139,140,142,143,144,146,147) ' +
//   'AND `messages`.`id` IN (SELECT MIN(m2.id) FROM messages as m2 join tickets as t2 on t2.id = m2.ticket_id GROUP BY t2.id) GROUP BY `tickets`.`id`, `messages`.`id`'
  
//   await db.query(query/* + ' LIMIT 15000 OFFSET 5000'*/).then(async d => {
//     const reasons = new BayesClassifier(PorterStemmerRu)
//     // const query0 = 'SELECT `reasons`.`name`, `reasons`.`keywords` FROM `reasons` WHERE `reasons`.`isDeleted` = 0 ' +
//     // 'AND `reasons`.`id` IN (2,9,10,11,12,13,19,20,21,22,23,27,28,29,43,44,57,65,67,68,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,93,95,99,102,103,104,105,106,112,113,115,119,120,121,122,123,124,125,127,128,130,133,134,135,137,138,139,140,141,142,143,144,145,146,147,148,150,151,152)'

//     // await db.query(query0).then(async d0 => {
//       // console.log(d0)
//       // d0[0].forEach(i => d[0].push(i))
//       // return

//       d[0].forEach(item => {
//         reasons.addDocument(item.text, item.label)
//       })
//       reasons.train()
    
//       // console.log('-- ' + message)
//       const result = reasons.classify(message)
//       res.status(200).end(result)
//     // }).catch(console.error)
//   }).catch(console.error)
  

//   // let data = GetData()
//   // // GetData().then(d => {
//   //   // console.log(typeof data)
//   //   console.log(data)
  
//   //   const reasons = new BayesClassifier(PorterStemmerRu)
  
//   //   data.forEach(item => reasons.addDocument(item.text, item.label))
//   //   reasons.train()
  
//   //   let text = 'В офис нужен новый стол и шкаф'
//   //   console.log(reasons.classify(text))
//   // // })
// }
