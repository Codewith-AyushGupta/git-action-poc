const AWS = require("aws-sdk");
const { uuid } = require("uuidv4");

const athena = new AWS.Athena();
const sqs = new AWS.SQS(); // Missing initialization added here

exports.handler = async (event) => {
  console.log("handler event:", JSON.stringify(event));

  const queryString = "SELECT current_timestamp;"; // Corrected dummy query
//   const queryString = "SELECT * FROM non_existent_table;"; // Corrected dummy query
  try {
      const queryExecution = await athena.startQueryExecution({
          QueryString: queryString,
          QueryExecutionContext: { Database: "default" },
          ResultConfiguration: {
              OutputLocation: "s3://athena-output-ap-south-1-poc/",
            },
            WorkGroup: "POC-AP-SOUTH-1",
        }).promise();
        
        console.log("Query Execution Started:", queryExecution);
          throw new Error('Intentional Error');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Query started", queryExecutionId: queryExecution.QueryExecutionId }),
    };
  } catch (error) {
    console.error("Athena Query Error:", error);

    // Fallback to SQS
    const params = {
      MessageBody: queryString,
      QueueUrl: process.env.AthenaFallBackQueue,
      MessageGroupId: uuid(),
      MessageDeduplicationId: uuid(),
    };

    console.log("Sending to fallback SQS with params:", JSON.stringify(params));

    try {
      const sqsResponse = await sqs.sendMessage(params).promise();
      console.log("SQS Response:", sqsResponse);

      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Query failed, message sent to fallback SQS", error: error.message }),
      };
    } catch (sqsError) {
      console.error("SQS Send Error:", sqsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Query and SQS fallback both failed", error: sqsError.message }),
      };
    }
  }
};
