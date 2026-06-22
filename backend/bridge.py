# -*- coding: utf-8 -*-
import paho.mqtt.client as mqtt
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
import json
from datetime import datetime, timezone


MQTT_BROKER   = "localhost"
MQTT_PORT     = 1883
INFLUX_URL    = "https://eu-central-1-1.aws.cloud2.influxdata.com"
INFLUX_TOKEN  = "h9Sw6VkCUdfCO-BZgeV6FH-64R6VEO-DRAIWDbKYiwHav-GPWcO0-4Wh57-HThlT24-3xX00rvMtCycmU_Eadg=="
INFLUX_ORG    = "pfe_agricole"
INFLUX_BUCKET = "energie"


TOPICS_CONFIG = {
    "agricole/site/total/telemetry":  "total",
    "agricole/site/solaire/telemetry": "solaire",
}

influx_client = InfluxDBClient(
    url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG
)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connecte au broker MQTT")
        for topic in TOPICS_CONFIG.keys():
            client.subscribe(topic)
            print(f"Abonne a : {topic}")
    else:
        print(f"Erreur connexion MQTT : {rc}")

def on_message(client, userdata, msg):
    try:
        topic       = msg.topic
        measurement = TOPICS_CONFIG.get(topic, "inconnu")
        payload     = json.loads(msg.payload.decode("utf-8"))
        timestamp   = datetime.now(timezone.utc)

        print(f"\n Topic    : {topic}")
        print(f"   Measurement : {measurement}")
        print(f"   Donnees  : {payload}")


        if measurement == "solaire":
            fields_map = {
                "tension_s":             "tension",
                "courant_s":             "courant",
                "frequence_s":           "frequence",
                "facteur_puissance_s":   "facteur_puissance",
                "puissance_active_s":    "puissance_active",
                "puissance_reactive_s":  "puissance_reactive",
                "puissance_apparente_s": "puissance_apparente",
                "energie_active_s":      "energie_active",
                "energie_reactive_s":    "energie_reactive",
                "energie_apparente_s":   "energie_apparente",
            }
        else:
            fields_map = {
                "tension":             "tension",
                "courant":             "courant",
                "frequence":           "frequence",
                "facteur_puissance":   "facteur_puissance",
                "puissance_active":    "puissance_active",
                "puissance_reactive":  "puissance_reactive",
                "puissance_apparente": "puissance_apparente",
                "energie_active":      "energie_active",
                "energie_reactive":    "energie_reactive",
                "energie_apparente":   "energie_apparente",
            }

        point     = Point(measurement).time(timestamp)
        nb_fields = 0

        for payload_key, influx_field in fields_map.items():
            if payload_key in payload:
                val = payload[payload_key]
                try:
                    val_float = float(val)
                    if val_float != -1:
                        point = point.field(influx_field, val_float)
                        nb_fields += 1
                except (ValueError, TypeError):
                    print(f" Valeur ignoree pour {payload_key} : {val}")
                    continue

        if nb_fields > 0:
            write_api.write(
                bucket=INFLUX_BUCKET,
                org=INFLUX_ORG,
                record=point
            )
            print(f"{nb_fields} champs ecrits dans InfluxDB [{measurement}]")
        else:
            print(f"Aucun champ valide recu")

    except json.JSONDecodeError as e:
        print(f"Erreur JSON : {e}")
    except Exception as e:
        print(f"Erreur : {e}")

def on_disconnect(client, userdata, rc):
    print(f"Deconnecte (rc={rc})")


client = mqtt.Client(client_id="bridge_pfe", clean_session=True)
client.on_connect    = on_connect
client.on_message    = on_message
client.on_disconnect = on_disconnect

print("Demarrage bridge MQTT  InfluxD Cloud")
print(f"Broker   : {MQTT_BROKER}:{MQTT_PORT}")
print(f"InfluxDB : {INFLUX_URL}")
print(f"Topics   : {list(TOPICS_CONFIG.keys())}")
print("=" * 50)

try:
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_forever()
except KeyboardInterrupt:
    print("\n Arret bridge")
    client.disconnect()
    influx_client.close()
except Exception as e:
    print(f" Erreur : {e}")
