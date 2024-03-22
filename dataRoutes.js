const express = require('express');
const router = express.Router();
const connection = require('./dbConnect');
const jwt = require('jsonwebtoken');

const secretKey = '123';
const user = { id: 1, username: 'admin' };

// User Authentication FN-27-11-23
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const query = 'SELECT id, username, password FROM users WHERE username = ? AND password = ?';
        connection.query(query, [username, password], (error, results) => {
            if (error) {
                console.error('Database error:', error);
                return res.status(500).json({ message: 'Internal server error' });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'Incorrect Username or Password' });
            }
            const token = jwt.sign(user, secretKey, { expiresIn: '1h' });
            res.header(secretKey, token).json({ message: 'Login successful', token });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Adding User
router.post('/data', (req, res) => {
    const { username, email, password, repassword } = req.body;
    const insertUser = `INSERT INTO users (username, email, password, repassword) VALUES (?, ?, ?, ?)`;

    connection.query(insertUser, [username, email, password, repassword], (err, result) => {
        if (err) {
            console.error('Failed to add user', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// User Remove
router.delete('/data/:id', (req, res) => {
    const userId = req.params.id;
    const deleteQuery = `DELETE FROM users WHERE id = ?`;

    connection.query(deleteQuery, userId, (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// User Visibility
router.get('/data', (req, res) => {
    const selectUsers = `SELECT * FROM users`;

    connection.query(selectUsers, (err, rows) => {
        if (err) {
            console.error('Error retriving users: ', err);
            res.sendStatus(500);
        } else {
            res.status(200).json(rows);
        }
    });
});

// **************Income API's*******************
// Add income 
router.post('/income', (req, res) => {
    const { date, description, amount } = req.body;
    const adIncome = `INSERT INTO income ( date, description, amount) VALUES (?, ?, ?)`;

    connection.query(adIncome, [date, description, amount], (err, result) => {
        if (err) {
            console.error('Failed to add income', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// Income Visibility
router.get('/incomelist', (req, res) => {
    const selectIncome = `SELECT * FROM income`;

    connection.query(selectIncome, (err, rows) => {
        if (err) {
            console.error('Error retriving income: ', err);
            res.sendStatus(500);
        } else {
            res.status(200).json(rows);
        }
    });
});

// Remove an income
router.delete('/removeincome/:id', (req, res) => {
    const incomeId = req.params.id;
    const deleteQuery = `DELETE FROM income WHERE id = ?`;

    connection.query(deleteQuery, incomeId, (err, result) => {
        if (err) {
            console.error('Error deleting income:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// **************Expense API's*******************
// Add Expense
router.post('/expense', (req, res) => {
    const { date, description, amount } = req.body;
    const adExpense = `INSERT INTO expense ( date, description, amount) VALUES (?, ?, ?)`;

    connection.query(adExpense, [date, description, amount], (err, result) => {
        if (err) {
            console.error('Failed to add income', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// Expense Visibility
router.get('/expenselist', (req, res) => {
    const selectIncome = `SELECT * FROM expense`;

    connection.query(selectIncome, (err, rows) => {
        if (err) {
            console.error('Error retriving expense: ', err);
            res.sendStatus(500);
        } else {
            res.status(200).json(rows);
        }
    });
});

// Remove an Expense
router.delete('/removeexpense/:id', (req, res) => {
    const expenseId = req.params.id;
    const deleteQuery = `DELETE FROM expense WHERE id = ?`;

    connection.query(deleteQuery, expenseId, (err, result) => {
        if (err) {
            console.error('Error deleting expense:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});


// dateUtils.js
const getPreviousDate = (currentDate) => {
    const current = new Date(currentDate);
    const previousDay = new Date(current);
    previousDay.setDate(current.getDate() - 1);
    return previousDay.toISOString().split('T')[0];
};

// dataRoutes.js
const storeBalanceQuery = `
    INSERT INTO daily_balance (date, balance_amount)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE balance_amount = VALUES(balance_amount)`;

const checkExistingBalanceQuery = `
    SELECT COUNT(*) as count
    FROM daily_balance
    WHERE DATE(date) = ?`;

const previousDayBalanceQuery = `
    SELECT balance_amount
    FROM daily_balance
    WHERE DATE(date) = ? - INTERVAL 1 DAY`;

// Endpoint to fetch daily report details
router.get('/daily-report-details', async (req, res) => {
    const { date } = req.query; // Date format: YYYY-MM-DD
    try {
        // Check if an entry for the current date already exists in daily_balance
        const existingBalanceResult = await executeQuery(checkExistingBalanceQuery, [date]);
        const entryExists = existingBalanceResult[0].count > 0;

        if (!entryExists) {
            // If entry does not exist, insert a new one
            await executeQuery(storeBalanceQuery, [date, 0]);
        }

        // Query to fetch daily income and expense for the specified date
        const dailyReportQuery = `
            SELECT 'Income' AS type, DATE_FORMAT(date, '%Y-%m-%d') AS date, description, amount
            FROM income
            WHERE DATE(date) = ? OR (DATE(date) = ? - INTERVAL 1 DAY AND description = 'Running Balance')
            UNION ALL
            SELECT 'Expense' AS type, DATE_FORMAT(date, '%Y-%m-%d') AS date, description, amount FROM expense WHERE DATE(date) = ?
            ORDER BY date`;

        // Query to fetch the total income for the specified date
        const totalIncomeQuery = `SELECT SUM(amount) AS totalIncome FROM income WHERE DATE(date) = ?`;

        // Query to fetch the total expense for the specified date
        const totalExpenseQuery = `SELECT SUM(amount) AS totalExpense FROM expense WHERE DATE(date) = ?`;

        // Execute all queries in parallel
        const [dailyReport, totalIncomeResult, totalExpenseResult] = await Promise.all([
            executeQuery(dailyReportQuery, [date, date, date]),
            executeQuery(totalIncomeQuery, [date]),
            executeQuery(totalExpenseQuery, [date])
        ]);

        const totalIncome = totalIncomeResult[0].totalIncome || 0;
        const totalExpense = totalExpenseResult[0].totalExpense || 0;

        // Execute the query to retrieve the previous day's running balance
        const previousDayBalanceResult = await executeQuery(previousDayBalanceQuery, [date]);

        // Get the previous day's running balance amount from the result
        const previousDayBalanceAmount = previousDayBalanceResult[0] ? previousDayBalanceResult[0].balance_amount || 0 : 0;

        // Include a separate entry for the running balance in the daily report
        const runningBalanceEntry = {
            type: 'Income',
            date: getPreviousDate(date),
            description: 'Running Balance',
            amount: previousDayBalanceAmount,
        };

        // Unshift the running balance entry to the beginning of the array
        dailyReport.unshift(runningBalanceEntry);

        // Calculate the total income considering the balance from the previous day
        const updatedTotalIncome = totalIncome + previousDayBalanceAmount;

        // Calculate the balance for the current day
        const balance = updatedTotalIncome - totalExpense;

        // Calculate the total running balance (including previous days)
        const totalBalanceRunning = updatedTotalIncome - totalExpense;

        // Execute the query to store the balance (update if it already exists)
        await executeQuery(storeBalanceQuery, [date, totalBalanceRunning]);

        // Send the response with the modified data
        res.status(200).json({ dailyReport, totalIncome: updatedTotalIncome, totalExpense, balance, totalBalanceRunning });
    } catch (error) {
        console.error('Error retrieving daily report:', error);
        res.status(500).json({ error: error.message });
    }
});

// Assume executeQuery is a function to handle the database queries (connection.query or any other method)
function executeQuery(sql, values) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(results);
        });
    });
}

// Assume executeQuery is a function to handle the database queries (connection.query or any other method)
function executeQuery(sql, values) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(results);
        });
    });
}

// Adding Customer 23-12-05
router.post('/addcustomer', (req, res) => {
    const { cus_name, cus_email, cus_mob, cus_code } = req.body;
    const insertCustomer = `INSERT INTO customers (cus_name, cus_email, cus_mob, cus_code) VALUES (?, ?, ?, ?)`;

    connection.query(insertCustomer, [cus_name, cus_email, cus_mob, cus_code], (err, result) => {
        if (err) {
            console.error('Failed to add customer', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// Customer Visibility
router.get('/viewcustomers', (req, res) => {
    const selectcustomers = `SELECT * FROM customers`;

    connection.query(selectcustomers, (err, rows) => {
        if (err) {
            console.error('Error retriving customers: ', err);
            res.sendStatus(500);
        } else {
            res.status(200).json(rows);
        }
    });
});

// Customer Remove
router.delete('/removecust/:id', (req, res) => {
    const customerId = req.params.id;
    const deleteQuery = `DELETE FROM customers WHERE id = ?`;

    connection.query(deleteQuery, customerId, (err, result) => {
        if (err) {
            console.error('Error deleting customer:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

//Add credit to a customer
router.post('/addcredit', (req, res) => {
    const { customer_name, credit_amount, description, credit_date, due_date, payment_type } = req.body;

    const insertCredit = `INSERT INTO credits (customer_name, credit_amount, description, credit_date, due_date, payment_type) VALUES (?, ?, ?, ?, ?, ?)`;

    connection.query(insertCredit, [customer_name, credit_amount, description, credit_date, due_date, payment_type], (err, result) => {
        if (err) {
            console.error('Failed to add credit:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

//Delete credit to a customer
router.delete('/deletecredit/:id', (req, res) => {
    const creditId = req.params.id;

    const deleteCredit = `DELETE FROM credits WHERE id = ?`;

    connection.query(deleteCredit, [creditId], (err, result) => {
        if (err) {
            console.error('Failed to delete credit:', err); // Log the error details
            res.sendStatus(500);
        } else {
            if (result.affectedRows > 0) {
                console.log('Credit deleted successfully');
                res.sendStatus(200);
            } else {
                console.log('Credit not found');
                res.sendStatus(404);
            }
        }
    });
});

// View credits of customers
router.get('/viewcredits', (req, res) => {
    const selectCredits = `SELECT * FROM credits`;

    connection.query(selectCredits, (err, rows) => {
        if (err) {
            console.error('Error retrieving credits: ', err);
            res.status(500).send('Internal server error');
        } else {
            res.status(200).json(rows);
        }
    });
});

// Endpoint to fetch customers' names and codes for dropdown
router.get('/customers-dropdown', (req, res) => {
    const selectCustomers = `SELECT cus_name, cus_code FROM customers`;

    connection.query(selectCustomers, (err, rows) => {
        if (err) {
            console.error('Error retrieving customers for dropdown: ', err);
            res.status(500).send('Internal server error');
        } else {
            res.status(200).json(rows);
        }
    });
});

// Backend Endpoint for Customer's Credit History
router.get('/customer/history/:customerName', (req, res) => {
    const customerName = req.params.customerName;

    const customerHistoryQuery = `
        SELECT 
            IF(STR_TO_DATE(credit_date, '%Y-%m-%d'), credit_date, '-') AS credit_date,
            IFNULL(credit_amount, '-') AS credit_amount, 
            IFNULL(payment_type, '-') AS payment_type, 
            CASE
                WHEN STR_TO_DATE(due_date, '%Y-%m-%d') IS NULL THEN '-'
                ELSE due_date
            END AS due_date,
            'credit' AS type
        FROM credits
        WHERE customer_name = ?

        UNION ALL

        SELECT 
            IF(STR_TO_DATE(credit_date, '%Y-%m-%d'), credit_date, '-') AS credit_date,
            IFNULL(repayment_amount, '-') AS credit_amount, 
            '-' AS payment_type, 
            '-' AS due_date, 
            'credit income' AS type
        FROM credit_income
        WHERE customer_name = ?`;

    connection.query(customerHistoryQuery, [customerName, customerName], (err, rows) => {
        if (err) {
            console.error('Error fetching customer history:', err);
            res.sendStatus(500);
        } else {
            res.json(rows);
        }
    });
});


// router.get('/customer/history/:customerName', (req, res) => {
//     const customerName = req.params.customerName;

//     // Query to fetch credit history based on customer's name
//     const customerHistoryQuery = `
//         SELECT credit_date, credit_amount, due_date, payment_type
//         FROM credits
//         WHERE customer_name = ?`;

//     connection.query(customerHistoryQuery, [customerName], (err, rows) => {
//         if (err) {
//             console.error('Error fetching customer history:', err);
//             res.sendStatus(500);
//         } else {
//             res.json(rows); // Send the fetched history data as JSON response
//         }
//     });
// });

// Adding Repayment to Credit Income and Updating Credit Amount
router.post('/credit-repayments', (req, res) => {
    const { date, description, amount } = req.body;
    const addIncome = `INSERT INTO credit_income ( credit_date,  customer_name, repayment_amount) VALUES (?, ?, ?)`;

    connection.query(addIncome, [date, description, amount], (err, result) => {
        if (err) {
            console.error('Failed to add credit repayment', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});


//Add Lenders
router.post('/add-lender', (req, res) => {
    const { name, email, mobile, lender_code } = req.body;
    const addLenders = `INSERT INTO lenders (lender_name, lender_email, lender_phone, lender_code) VALUES (?, ?, ?, ?)`;

    connection.query(addLenders, [name, email, mobile, lender_code], (err, result) => {
        if (err) {
            console.error('Faild to add Lenders', err);
            res.status(500);
        } else {
            res.sendStatus(200);
        }
    });
});

//retriving lenders details
router.get('/view-lenders', (req, res) => {
    const selectLenders = `SELECT * FROM lenders`;

    connection.query(selectLenders, (err, rows) => {
        if (err) {
            console.error('Error retriving Lenders: ', err);
            res.sendStatus(500);
        } else {
            res.status(200).json(rows);
        }
    });
});

// Lendor Remove
router.delete('/remove-lenders/:id', (req, res) => {
    const lendersId = req.params.id;
    const deleteLenders = `DELETE FROM lenders WHERE id = ?`;

    connection.query(deleteLenders, lendersId, (err, result) => {
        if (err) {
            console.error('Error deleting lender:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

//Add lend to a lendor
router.post('/add-lend', (req, res) => {
    const { lender_name, lend_amount, description, lend_date, repayment_date, payment_type } = req.body;

    const insertLend = `INSERT INTO lending (lender_name, lend_amount, description, lend_date, repayment_date, payment_type) VALUES (?, ?, ?, ?, ?, ?)`;

    connection.query(insertLend, [lender_name, lend_amount, description, lend_date, repayment_date, payment_type], (err, result) => {
        if (err) {
            console.error('Failed to add Lend:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

//retriving lending details
router.get('/view-lending', (req, res) => {
    const selectLendings = `SELECT * FROM lending`;

    connection.query(selectLendings, (err, rows) => {
        if (err) {
            console.error('Error retriving Lendings: ', err);
            res.sendStatus(500);
        } else {
            res.status(200).json(rows);
        }
    });
});

// Lending Remove
router.delete('/remove-lending/:id', (req, res) => {
    const lendingId = req.params.id;
    const deleteLending = `DELETE FROM lending WHERE id = ?`;

    connection.query(deleteLending, lendingId, (err, result) => {
        if (err) {
            console.error('Error deleting lending:', err);
            res.sendStatus(500);
        } else {
            res.sendStatus(200);
        }
    });
});

// Endpoint to fetch lender's names 
router.get('/lenders-dropdown', (req, res) => {
    const selectLenders = `SELECT lender_name, lender_code FROM lenders`;

    connection.query(selectLenders, (err, rows) => {
        if (err) {
            console.error('Error retrieving lenders for dropdown: ', err);
            res.status(500).send('Internal server error');
        } else {
            res.status(200).json(rows);
        }
    });
});

// Endpoint to fetch lender amount for perticular amount
router.get('/lender/lend-amount/:lenderName', (req, res) => {
    const lenderName = req.params.lenderName;

    const lendAmountQuery = `
        SELECT 
            (SELECT COALESCE(SUM(lend_amount), 0) FROM lending WHERE lender_name = ?) - 
            (SELECT COALESCE(SUM(repayment_amount), 0) FROM lender_repayment WHERE lender_name = ?) AS remaining_due_amount`;

    connection.query(lendAmountQuery, [lenderName, lenderName], (err, result) => {
        if (err) {
            console.error('Error fetching remaining due amount:', err);
            res.sendStatus(500);
        } else {
            const remainingDueAmount = result[0].remaining_due_amount || 0;
            res.json({ remainingDueAmount });
        }
    });
});


// Insert the lending repayment
router.post('/lend-repayment', (req, res) => {
    const { repayment_date, repayment_amount, lender_name } = req.body;
    const addLenderRepayment = `INSERT INTO lender_repayment (repayment_date, repayment_amount, lender_name) VALUES (?, ?, ?)`;

    connection.query(addLenderRepayment, [repayment_date, repayment_amount, lender_name], (err, result) => {
        if (err) {
            console.error('Failed to add Lender Repayment', err);
            res.status(500).send('Failed to add Lender Repayment');
        } else {
            res.sendStatus(200);
        }
    });
});

// Backend Endpoint for Lending History
router.get('/lending/history/:lenderName', (req, res) => {
    const lenderName = req.params.lenderName;

    const historyQuery = `
    SELECT 
    lender_name,
    lend_date AS date,
    lend_amount AS amount,
    description,
    payment_type,
    repayment_date AS promised_return_date, -- Use repayment_date as promised return date for lending entries
    'lend' AS type
FROM lending
WHERE lender_name = ?
    
UNION ALL
    
SELECT 
    lender_name,
    repayment_date AS date,
    repayment_amount AS amount,
    NULL AS description,
    NULL AS payment_type,
    NULL AS promised_return_date,  -- No promised return date for entries from lender_repayment
    'return' AS type
FROM lender_repayment
WHERE lender_name = ?
      
      ORDER BY date`;

    connection.query(historyQuery, [lenderName, lenderName], (err, rows) => {
        if (err) {
            console.error('Error fetching lending history:', err);
            res.status(500).json({ error: 'Error fetching lending history' });
        } else {
            res.json(rows);
        }
    });
});



// Backend API to retrieve recent debts with specific columns
router.get('/recent-debts', (req, res) => {
    const recentDebtsQuery = `
        SELECT customer_name, due_date, description, credit_amount 
        FROM credits 
        ORDER BY credit_date DESC 
        LIMIT 5`;

    connection.query(recentDebtsQuery, (err, rows) => {
        if (err) {
            console.error('Error retrieving recent debts: ', err);
            res.status(500).send('Error retrieving recent debts');
        } else {
            res.status(200).json(rows);
        }
    });
});



// Backend API to retrieve recent lendings
router.get('/recent-lends', (req, res) => {
    const recentLendsQuery = `
        SELECT lender_name, repayment_date, description, lend_amount 
        FROM lending 
        ORDER BY lend_date DESC 
        LIMIT 5`;

    connection.query(recentLendsQuery, (err, rows) => {
        if (err) {
            console.error('Error retrieving recent lends: ', err);
            res.status(500).send('Error retrieving recent lends');
        } else {
            res.status(200).json(rows);
        }
    });
});


// Monthly Report Endpoint
router.get('/monthly-report-details', async (req, res) => {
    const { year, month } = req.query;

    try {
        const startOfMonth = `${year}-${month}-01`;
        const endOfMonth = `${year}-${month}-31`; // Consider using better logic for the last day of the month

        const monthlyTransactionsQuery = `
            SELECT 
                'Income' AS type,
                DATE_FORMAT(date, '%Y-%m-%d') AS date, 
                description, 
                amount 
            FROM income 
            WHERE DATE(date) BETWEEN ? AND ?
            
            UNION ALL
            
            SELECT 
                'Expense' AS type,
                DATE_FORMAT(date, '%Y-%m-%d') AS date, 
                description, 
                amount 
            FROM expense 
            WHERE DATE(date) BETWEEN ? AND ?
            ORDER BY date`;

        const transactionsResult = await executeQuery(monthlyTransactionsQuery, [startOfMonth, endOfMonth, startOfMonth, endOfMonth]);

        res.status(200).json(transactionsResult);
    } catch (error) {
        console.error('Error retrieving monthly report:', error);
        res.sendStatus(500);
    }
});

// Define the route to clear running balance
router.delete('/clearRunningBalance', (req, res) => {
    const clearRunningBalanceQuery = 'TRUNCATE TABLE daily_balance';

    connection.query(clearRunningBalanceQuery, (error, results) => {
        if (error) {
            console.error('Error clearing running balance:', error);
            res.sendStatus(500);
        } else {
            res.status(200).json({ message: 'Running balance cleared successfully' });
        }
    });
});

//---------------------------GOLD ACCOUNT---------------------------

// Add investors
router.post('/investors', (req, res) => {
    const { date, investment, mobile_no, investor_name, country } = req.body;

    // Check if the investor with the same name and mobile number already exists
    const checkExistingInvestorQuery = `
        SELECT * FROM investors
        WHERE investor_name = ? AND mobile_no = ?
    `;

    connection.query(checkExistingInvestorQuery, [investor_name, mobile_no], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking existing investor:', checkErr);
            res.sendStatus(500);
        } else if (checkResult.length > 0) {
            // Investor already exists, send a notification or error message
            res.status(409).json({ error: 'Investor with the same name and mobile number already exists' });
        } else {
            // Investor doesn't exist, proceed with the insertion
            const insertInvestors = `INSERT INTO investors (date, investment, mobile_no, investor_name, country) VALUES (?, ?, ?, ?, ?)`;

            connection.query(insertInvestors, [date, investment, mobile_no, investor_name, country], (insertErr, result) => {
                if (insertErr) {
                    console.error('Failed to add investor:', insertErr);
                    res.sendStatus(500);
                } else {
                    res.sendStatus(200);
                }
            });
        }
    });
});

// Backend Endpoint for fetching investors list
router.get('/investors', (req, res) => {
    const fetchInvestorsQuery = `
      SELECT id, date, investment, mobile_no, investor_name, country
      FROM investors
      ORDER BY date DESC;`;

    connection.query(fetchInvestorsQuery, (err, results) => {
        if (err) {
            console.error('Error fetching investors:', err);
            res.status(500).json({ error: 'Error fetching investors' });
        } else {
            res.json(results);
        }
    });
});

//Remove Investor
router.delete('/removeinvestors/:id', (req, res) => {
    const investorId = req.params.id;

    const deleteInvestorQuery = `
        DELETE FROM investors
        WHERE id = ?
    `;

    connection.query(deleteInvestorQuery, [investorId], (deleteErr, deleteResult) => {
        if (deleteErr) {
            console.error('Error deleting investor:', deleteErr);
            res.sendStatus(500);
        } else if (deleteResult.affectedRows === 0) {
            res.status(404).json({ error: 'Investor not found' });
        } else {
            res.sendStatus(200);
        }
    });
});

// Get reinvestment data for a specific investor
router.get('/investor-total/:name', (req, res) => {
    const investorName = req.params.name;

    const getTotalInvestmentQuery = `
    SELECT i.investment + COALESCE(SUM(r.reinvestment), 0) AS total_investment
    FROM investors i
    LEFT JOIN re_investment r ON i.investor_name = r.investor_name
    WHERE i.investor_name = ?
    GROUP BY i.investor_name, i.investment;
    `;

    connection.query(getTotalInvestmentQuery, [investorName], (err, result) => {
        if (err) {
            console.error('Error fetching total investment:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json({ total_investment: result[0].total_investment });
        }
    });
});

// Add re-investment
router.post('/reinvestments', (req, res) => {
    const { date, investment, mobile_no, investor_name, country, reinvestment } = req.body;

    const insertReinvestmentQuery = `
    INSERT INTO re_investment (date, investment, mobile_no, investor_name, country, reinvestment)
    VALUES (?, ?, ?, ?, ?, ?)
    `;

    connection.query(
        insertReinvestmentQuery,
        [date, investment, mobile_no, investor_name, country, reinvestment],
        (insertErr, result) => {
            if (insertErr) {
                console.error('Failed to add reinvestment:', insertErr);
                res.sendStatus(500);
            } else {
                res.sendStatus(200);
            }
        }
    );
});

//Add Currency
router.post('/currency', (req, res) => {
    const { date, time, rate, currency_name } = req.body;

    const insertCurrency = `INSERT INTO currency_rates (date, time, rate, currency_name) VALUES (?, ?, ?, ?)`;

    connection.query(
        insertCurrency,
        [date, time, rate, currency_name],
        (insertErr, result) => {
            if (insertErr) {
                console.error('Failed to add currency:', insertErr);
                res.sendStatus(500);
            } else {
                res.sendStatus(200);
            }
        }
    );
});

//Remove Currency
router.delete('/currency/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM currency_rates WHERE id = ?';

    connection.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error deleting currency rate:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json({ message: 'Currency rate deleted successfully' });
    });
});

//fetch currency rates
router.get('/currency-rates', (req, res) => {
    const getCurrencyRates = `SELECT * FROM currency_rates ORDER BY date DESC, time DESC`;

    connection.query(getCurrencyRates, (err, results) => {
        if (err) {
            console.error('Failed to fetch currency rates:', err);
            res.sendStatus(500);
        } else {
            res.json(results);
        }
    });
});

//Fetch rates INR to LKR from the table
router.get('/currency-rates-purchasing', (req, res) => {
    const { currency_name } = req.query;
    const query = `SELECT * FROM currency_rates WHERE currency_name = ? ORDER BY date DESC LIMIT 1`;

    connection.query(query, [currency_name], (err, results) => {
        if (err) {
            console.error('Error fetching currency rate:', err);
            res.status(500).json({ error: 'Internal Server Error' });
            return;
        }

        res.json(results);
    });
});

// Get the last inserted INR to LKR currency record
router.get('/latest-inr-to-lkr', (req, res) => {
    const getLatestCurrencyQuery = `
        SELECT * FROM currency_rates
        WHERE currency_name = 'INR to LKR'
        ORDER BY id DESC
        LIMIT 1;
    `;

    connection.query(getLatestCurrencyQuery, (err, results) => {
        if (err) {
            console.error('Error fetching latest INR to LKR currency:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'No INR to LKR currency data found' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});

//Insert Purchase to the DB
router.post('/gold-purchase', (req, res) => {
    const { purchaseDate, category, goldWeightInG, gramPrice, totallkr, totalinr, inrtolkr } = req.body;

    const insertGoldPurchase = `
        INSERT INTO gold_purchases (purchaseDate, category, goldWeightInG, gramPrice, totallkr, totalinr, inrtolkr)
        VALUES (?, ?, ?, ?, ?, ?,?)
    `;

    connection.query(insertGoldPurchase, [purchaseDate, category, goldWeightInG, gramPrice, totallkr, totalinr, inrtolkr], (err, result) => {
        if (err) {
            console.error('Error inserting into gold_purchases:', err);
            res.status(500).send('Error inserting into gold_purchases');
        } else {
            res.status(200).send('Gold purchase added successfully');
        }
    });
});

//view purchase
router.get('/view-gold-purchase', (req, res) => {
    const selectGoldPurchases = 'SELECT * FROM gold_purchases';

    connection.query(selectGoldPurchases, (err, results) => {
        if (err) {
            console.error('Error fetching gold purchases:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Delete a gold purchase entry by ID
router.delete('/delete-gold-purchase/:id', (req, res) => {
    const purchaseId = req.params.id;

    const deleteGoldPurchase = 'DELETE FROM gold_purchases WHERE id = ?';

    connection.query(deleteGoldPurchase, [purchaseId], (err, results) => {
        if (err) {
            console.error('Error deleting gold purchase:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            res.status(200).json({ message: 'Gold purchase deleted successfully' });
        }
    });
});

// API endpoint to insert a new sell record
router.post('/gold-sell', (req, res) => {
    const { sellDate, category, gramPrice, goldWeightInG, totalinr, totallkr, inrtolkr, totalExpense, totalAmountAfterExpense, expense } = req.body;

    const sql = 'INSERT INTO gold_sell_ind (sellDate, category, gramPrice, goldWeightInG, totalinr, totallkr, inrtolkr, totalExpense_inr, totalAmountAfterExpense_lkr, expense_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [sellDate, category, gramPrice, goldWeightInG, totalinr, totallkr, inrtolkr, totalExpense, totalAmountAfterExpense, expense];

    connection.query(sql, values, (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Error inserting sell record' });
        } else {
            res.status(200).json({ message: 'Sell record inserted successfully' });
        }
    });
});

// API endpoint to fetch sell records
router.get('/view-gold-sell-ind', (req, res) => {
    const sql = 'SELECT id, sellDate, category, goldWeightInG,gramPrice, totalinr, inrtolkr, totalExpense_inr, totalAmountAfterExpense_LKR, expense_amount FROM gold_sell_ind';

    connection.query(sql, (err, rows) => {
        if (err) {
            console.error('Error fetching sell records:', err);
            res.status(500).json({ error: 'Error fetching sell records' });
        } else {
            res.status(200).json(rows);
        }
    });
});

router.delete('/delete-gold-sell/:id', (req, res) => {
    const sellRecordId = req.params.id;
    if (!sellRecordId) {
        return res.status(400).json({ error: 'No ID provided' });
    }
    const deleteGoldSellQuery = 'DELETE FROM gold_sell_ind WHERE id = ?';
    connection.query(deleteGoldSellQuery, [sellRecordId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        if (results && results.affectedRows > 0) {
            return res.status(200).json({ message: 'Gold sell deleted successfully' });
        } else {
            return res.status(404).json({ error: 'No matching sell record found for deletion' });
        }
    });
});


// Define the API endpoint for fetching monthly reports
router.get('/monthly-report', (req, res) => {
    // Extract the month and year from the query parameters
    const { month, year } = req.query;

    // Calculate the start and end dates for the specified month
    const startDate = new Date(year, month - 1, 1); // month is zero-based
    const endDate = new Date(year, month, 0); // Last day of the specified month

    // Query to fetch purchases and sales data for the specified month
    const purchaseQuery = `
        SELECT *
        FROM gold_purchases
        WHERE purchaseDate BETWEEN ? AND ?
    `;

    const salesQuery = `
        SELECT *
        FROM gold_sell_ind
        WHERE sellDate BETWEEN ? AND ?
    `;

    // Execute both queries
    connection.query(purchaseQuery, [startDate, endDate], (error, purchaseResult) => {
        if (error) {
            return res.status(500).json({ error: 'Error fetching purchases' });
        }

        connection.query(salesQuery, [startDate, endDate], (error, salesResult) => {
            if (error) {
                return res.status(500).json({ error: 'Error fetching sales' });
            }

            // Construct the response object containing purchases and sales data
            const responseData = {
                purchases: purchaseResult,
                sales: salesResult
            };

            // Send the response
            res.status(200).json(responseData);
        });
    });
});

// API endpoint to insert a new purchase transaction record
router.post('/purchase_transactions', (req, res) => {
    const { transactionDate, investor, investedAmount, goldWeight, gramPrice, totalInLKR, totalInINR, description, inr_to_lkr } = req.body;

    const sql = 'INSERT INTO purchase_transactions (transaction_date, investor, invested_amount, gold_weight_in_g, gram_price, total_in_lkr, total_in_inr, description, inr_to_lkr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [transactionDate, investor, investedAmount, goldWeight, gramPrice, totalInLKR, totalInINR, description, inr_to_lkr];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting purchase transaction record:', err);
            return res.status(500).json({ error: 'Error inserting purchase transaction record' });
        } else {
            return res.status(201).json({ message: 'Purchase transaction added successfully' });
        }
    });
});


// API endpoint to insert a new sell transaction record
router.post('/sell_transactions', (req, res) => {
    const { transactionDate, investor, investedAmount, goldWeight, gramPrice, totalInLKR, totalInINR, description, inr_to_lkr, expense, totalAmountAfterExpense } = req.body;

    const sql = 'INSERT INTO sell_transactions (transaction_date, investor, invested_amount, gold_weight_sell_in_g, gram_price_sell, total_in_lkr, total_in_inr, description, inr_to_lkr, expense_inr, expense_lkr, total_after_expense_inr, total_after_expense_lkr) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const values = [transactionDate, investor, investedAmount, goldWeight, gramPrice, totalInLKR, totalInINR, description, inr_to_lkr, expense.inr, expense.lkr, totalAmountAfterExpense.inr, totalAmountAfterExpense.lkr];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting sell transaction record:', err);
            return res.status(500).json({ error: 'Error inserting sell transaction record' });
        } else {
            return res.status(201).json({ message: 'Sell transaction added successfully' });
        }
    });
});

// API endpoint to insert a new withdrawal transaction record
router.post('/withdrawal_transactions', (req, res) => {
    const { transactionDate, investor, investedAmount, withdrawalAmount, description } = req.body;

    const sql = 'INSERT INTO withdrawal_transactions (transaction_date, investor, invested_amount, withdrawal_amount, description) VALUES (?, ?, ?, ?, ?)';
    const values = [transactionDate, investor, investedAmount, withdrawalAmount, description];

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting withdrawal transaction record:', err);
            return res.status(500).json({ error: 'Error inserting withdrawal transaction record' });
        } else {
            return res.status(201).json({ message: 'Withdrawal transaction added successfully' });
        }
    });
});

// Retrieve purchase transactions
router.get('/view/purchase_transactions', (req, res) => {
    const query = 'SELECT * FROM purchase_transactions';

    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error retrieving purchase transactions:', err);
            return res.status(500).json({ error: 'Error retrieving purchase transactions' });
        } else {
            return res.status(200).json(results);
        }
    });
});


// Retrieve sell transactions
router.get('/view/sell_transactions', (req, res) => {
    connection.query('SELECT * FROM sell_transactions', (err, results) => {
        if (err) {
            console.error('Error retrieving sell transactions:', err);
            return res.status(500).json({ error: 'Error retrieving sell transactions' });
        } else {
            return res.status(200).json(results);
        }
    });
});

// Retrieve withdrawal transactions
router.get('/view/withdrawal_transactions', (req, res) => {
    connection.query('SELECT * FROM withdrawal_transactions', (err, results) => {
        if (err) {
            console.error('Error retrieving withdrawal transactions:', err);
            return res.status(500).json({ error: 'Error retrieving withdrawal transactions' });
        } else {
            return res.status(200).json(results);
        }
    });
});

// Delete a purchase transaction
router.delete('/purchase_transactions/:id', (req, res) => {
    const transactionId = req.params.id;
    const query = 'DELETE FROM purchase_transactions WHERE id = ?';

    connection.query(query, [transactionId], (err, result) => {
        if (err) {
            console.error('Error deleting purchase transaction:', err);
            return res.status(500).json({ error: 'Error deleting purchase transaction' });
        } else {
            return res.status(200).json({ message: 'Purchase transaction deleted successfully' });
        }
    });
});

// Delete a sell transaction
router.delete('/sell_transactions/:id', (req, res) => {
    const transactionId = req.params.id;
    const query = 'DELETE FROM sell_transactions WHERE id = ?';

    connection.query(query, [transactionId], (err, result) => {
        if (err) {
            console.error('Error deleting sell transaction:', err);
            return res.status(500).json({ error: 'Error deleting sell transaction' });
        } else {
            return res.status(200).json({ message: 'Sell transaction deleted successfully' });
        }
    });
});

// Delete a withdrawal transaction
router.delete('/withdrawal_transactions/:id', (req, res) => {
    const transactionId = req.params.id;
    const query = 'DELETE FROM withdrawal_transactions WHERE id = ?';

    connection.query(query, [transactionId], (err, result) => {
        if (err) {
            console.error('Error deleting withdrawal transaction:', err);
            return res.status(500).json({ error: 'Error deleting withdrawal transaction' });
        } else {
            return res.status(200).json({ message: 'Withdrawal transaction deleted successfully' });
        }
    });
});


// Endpoint to fetch combined transactions for a specific investor
router.get('/investor-report', (req, res) => {
    // Retrieve the investor name from the query parameters
    const investorName = req.query.name;

    // SQL query to fetch combined transactions for the specified investor
    const query = `
    (SELECT 
        'Purchase' as type, 
        transaction_date as date, 
        total_in_lkr as amount, 
        CASE 
            WHEN gold_weight_in_g - FLOOR(gold_weight_in_g) = 0 THEN CAST(gold_weight_in_g AS UNSIGNED)
            ELSE ROUND(gold_weight_in_g, 2)
        END as weight, -- Format weight to remove trailing zeros when necessary
        FORMAT(gram_price, 0) as gram_price, 
        '-' as expense, 
        description, 
        inr_to_lkr as rate 
    FROM purchase_transactions 
    WHERE investor = ?)
    UNION
    (SELECT 
        'Sell' as type, 
        transaction_date as date, 
        total_after_expense_lkr as amount, 
        CASE 
            WHEN gold_weight_sell_in_g - FLOOR(gold_weight_sell_in_g) = 0 THEN CAST(gold_weight_sell_in_g AS UNSIGNED)
            ELSE ROUND(gold_weight_sell_in_g, 2)
        END as weight, -- Format weight to remove trailing zeros when necessary
        FORMAT(gram_price_sell * inr_to_lkr, 0) as gram_price, 
        FORMAT(expense_lkr, 0) as expense, 
        description, 
        inr_to_lkr as rate 
    FROM sell_transactions 
    WHERE investor = ?)
    UNION
    (SELECT 
        'Withdrawal' as type, 
        transaction_date as date, 
        withdrawal_amount as amount, 
        '-' as weight, 
        '-' as gram_price, 
        '-' as expense, 
        'Withdrawal' as description, 
        '-' as rate 
    FROM withdrawal_transactions 
    WHERE investor = ?)
    ORDER BY type, date;
    
            `;

    // Execute the query with the investor name as parameter
    connection.query(query, [investorName, investorName, investorName], (err, results) => {
        if (err) {
            console.error('Error fetching combined transactions:', err);
            res.status(500).json({ error: 'Error fetching combined transactions' });
        } else {
            res.status(200).json(results);
        }
    });
});

// Helper function to execute a SQL query
function executeQuery(query, params) {
    return new Promise((resolve, reject) => {
        connection.query(query, params, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

module.exports = router;