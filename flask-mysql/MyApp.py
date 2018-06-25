from flask import Flask, jsonify
from flaskext.mysql import MySQL

app = Flask(__name__)
mysql = MySQL()

# MySQL configurations
app.config['MYSQL_DATABASE_USER'] = 'root'
app.config['MYSQL_DATABASE_PASSWORD'] = 'Ericss00n'
app.config['MYSQL_DATABASE_DB'] = 'dcp'
app.config['MYSQL_DATABASE_HOST'] = '112.74.84.98'

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
