const db = require('./db')

module.exports.GetData = () => {
  ParseData()
  // await db.authenticate().then(async () => {
  //   console.info('INFO - Database connected.')
  //   await ParseData()
  // }).catch(err => {
  //   console.error('ERROR - Unable to connect to the database: ', err.message)
  // })
}

ParseData = () => {
  const query = "SELECT `reasons`.`name` AS text, `messages`.`message` AS label FROM `tickets` JOIN `reasons` ON `reasons`.`id` = `tickets`.`reason_id` JOIN `messages` ON `messages`.`ticket_id` = `tickets`.`id` WHERE LOWER(`messages`.`message`) NOT LIKE LOWER('%тест%') AND `messages`.`id` IN (SELECT MIN(m2.id) FROM messages as m2 join tickets as t2 on t2.id = m2.ticket_id GROUP BY t2.id) GROUP BY `tickets`.`id`, `messages`.`id`"
  db.query(query + ' LIMIT 1').then(d => {
    console.log(d)
    return d
  })
  // console.log(data[0])
  // return data[0]
}