from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)

# Conexión a MongoDB
client = MongoClient("mongodb+srv://grindfull08:jAfLOfUwwnhxJVDR@dataset.mlkrnud.mongodb.net/")
db = client.qchaucoin
usuarios = db.usuarios

@app.route("/registro", methods=["POST"])
def registro():
    data = request.json
    if usuarios.find_one({"email": data["email"]}):
        return jsonify({"error": "Usuario ya registrado"}), 409
    usuarios.insert_one(data)
    return jsonify({"msg": "Registrado con éxito"}), 200

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    usuario = usuarios.find_one({"email": data["email"]})
    if not usuario or usuario["password"] != data["password"]:
        return jsonify({"error": "Credenciales inválidas"}), 401
    return jsonify({"msg": "Login exitoso", "usuario": usuario["nombre"]}), 200

if __name__ == "__main__":
    app.run(debug=True)
