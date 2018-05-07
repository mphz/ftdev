from flask import Flask, jsonify
from flaskext.mysql import MySQL

app = Flask(__name__)
mysql = MySQL()

# MySQL configurations
app.config['MYSQL_DATABASE_USER'] = 'dp'
app.config['MYSQL_DATABASE_PASSWORD'] = 't2017'
app.config['MYSQL_DATABASE_DB'] = 'dp'
app.config['MYSQL_DATABASE_HOST'] = 'localhost'

mysql.init_app(app)

@app.route('/')
def get():
    cur = mysql.connect().cursor()
    cur.execute('''select * from dcp.dcp_si_sim_range_inf''')
    r = [dict((cur.description[i][0], value)
              for i, value in enumerate(row)) for row in cur.fetchall()]
    return jsonify({'datHere' : r})

if __name__ == '__main__':
    app.run()