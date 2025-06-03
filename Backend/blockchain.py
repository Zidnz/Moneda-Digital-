from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256
import hashlib
import time
import json

def generar_claves():
    key = RSA.generate(2048)
    return key.publickey(), key

clave_publica, clave_privada = generar_claves()

print("🔐 Clave Pública:")
print(clave_publica.export_key().decode())

print("\n🔒 Clave Privada:")
print(clave_privada.export_key().decode())

def firmar_transaccion(mensaje, clave_privada):
    h = SHA256.new(mensaje.encode('utf-8'))
    firma = pkcs1_15.new(clave_privada).sign(h)
    return firma.hex()

def verificar_firma(mensaje, firma_hex, clave_publica):
    h = SHA256.new(mensaje.encode('utf-8'))
    try:
        pkcs1_15.new(clave_publica).verify(h, bytes.fromhex(firma_hex))
        return True
    except (ValueError, TypeError):
        return False
    

class Bloque:
    def __init__(self, indice, transacciones, hash_anterior):
        self.indice = indice
        self.timestamp = time.time()
        self.transacciones = transacciones
        self.hash_anterior = hash_anterior
        self.hash_actual = self.calcular_hash()

    def calcular_hash(self):
        bloque_string = json.dumps({
            'indice': self.indice,
            'timestamp': self.timestamp,
            'transacciones': self.transacciones,
            'hash_anterior': self.hash_anterior
        }, sort_keys=True).encode()
        return hashlib.sha256(bloque_string).hexdigest()
    

class Blockchain:
    def __init__(self):
        self.cadena = [self.crear_bloque_genesis()]

    def crear_bloque_genesis(self):
        return Bloque(0, ["Bloque Génesis"], "0")

    def agregar_bloque(self, transacciones):
        hash_anterior = self.cadena[-1].hash_actual
        nuevo_bloque = Bloque(len(self.cadena), transacciones, hash_anterior)
        self.cadena.append(nuevo_bloque)

    def mostrar_cadena(self):
        for bloque in self.cadena:
            print(f"\n--- Bloque {bloque.indice} ---")
            print(f"Hash anterior: {bloque.hash_anterior}")
            print(f"Hash actual : {bloque.hash_actual}")
            print(f"Transacciones: {bloque.transacciones}")
if __name__ == "__main__":
    pub_key, priv_key = generar_claves()
    mensaje_tx = "Erika manda 50 QchauCoins a XIme"
    firma_tx = firmar_transaccion(mensaje_tx, priv_key)
    es_valida = verificar_firma(mensaje_tx, firma_tx, pub_key)

    blockchain_qchau = Blockchain()
    if es_valida:
        blockchain_qchau.agregar_bloque([{
            'transaccion': mensaje_tx,
            'firma': firma_tx
        }])

    blockchain_qchau.mostrar_cadena()
    