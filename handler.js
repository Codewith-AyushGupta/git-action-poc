const AWS = require("aws-sdk");

const athena = new AWS.Athena();
const sqs = new AWS.SQS();

exports.hello = async (event) => {
  console.log("Handler triggered: changed.", JSON.stringify(event));

  const queueParams = {
    QueueUrl: process.env.AthenaFallBackQueue,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 10,
  };

  try {
    const sqsResponse = await sqs.receiveMessage(queueParams).promise();
    console.log('sqsResponse',JSON.stringify(sqsResponse));
    if (!sqsResponse?.Messages || sqsResponse?.Messages.length === 0) {
      console.log("No messages in fallback queue.");
      return 
    }

    const message = sqsResponse?.Messages[0];
    const queryString = message.Body;
    console.log("Received message from SQS:", queryString);
    try {
      const queryExecution = await athena.startQueryExecution({
        QueryString: queryString,
        QueryExecutionContext: { Database: "default" },
        ResultConfiguration: {
          OutputLocation: "s3://athena-output-ap-south-1-poc/",
        },
        WorkGroup: "POC-AP-SOUTH-1",
      }).promise();

      console.log("Athena accepted query:", queryExecution);
      await sqs.deleteMessage({
        QueueUrl: process.env.AthenaFallBackQueue,
        ReceiptHandle: message.ReceiptHandle,
      }).promise();
      console.log("Deleted message from SQS.");

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Query sent to Athena and message removed from fallback queue.",
          queryExecutionId: queryExecution.QueryExecutionId,
        }),
      };
    } catch (athenaError) {
      console.error("Athena failed to start query:", athenaError);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Athena failed to start query.", error: athenaError.message }),
      };
    }
  } catch (sqsError) {
    console.error("Failed to read from SQS:", sqsError);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to read from SQS.", error: sqsError.message }),
    };
  }
};
