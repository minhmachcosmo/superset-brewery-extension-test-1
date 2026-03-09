"""
Script pour créer une base de données SQLite avec des données de simulation de stock.
À exécuter pour tester l'extension Superset Brewery.
"""

import pandas as pd
import sqlite3
from pathlib import Path

# Données d'exemple de simulation de stock
data = """Simulation_run,Probe_instance,Probe_run,StockMeasure,csm_run_id,run_name
run-mr5l0lgnk1k9,StockProbe,0,50,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,1,47,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,2,46,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,3,41,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,4,36,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,5,33,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,6,30,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,7,26,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,8,24,run-mr5l0lgnk1k9,ReferenceScenario
run-mr5l0lgnk1k9,StockProbe,9,19,run-mr5l0lgnk1k9,ReferenceScenario
run-o6kgpq357v5m,StockProbe,0,50,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,1,45,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,2,40,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,3,35,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,4,30,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,5,25,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,6,20,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,7,15,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,8,10,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-o6kgpq357v5m,StockProbe,9,30,run-o6kgpq357v5m,PROD-15427-UpdatedDataset
run-9nw7yvq90meq,StockProbe,0,50,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,1,47,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,2,46,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,3,41,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,4,36,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,5,33,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,6,30,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,7,26,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,8,24,run-9nw7yvq90meq,TestSuperset2
run-9nw7yvq90meq,StockProbe,9,19,run-9nw7yvq90meq,TestSuperset2"""

def create_database():
    """Créer la base de données SQLite avec les données de simulation."""
    from io import StringIO
    
    # Créer un DataFrame depuis les données CSV
    df = pd.read_csv(StringIO(data))
    
    # Chemin vers la base de données
    db_path = Path(__file__).parent / 'simulation_stock.db'
    
    # Créer la connexion SQLite
    conn = sqlite3.connect(str(db_path))
    
    # Insérer les données
    df.to_sql('stock_simulation', conn, if_exists='replace', index=False)
    
    # Vérification
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM stock_simulation")
    count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"✅ Base de données créée avec succès !")
    print(f"📊 Nombre d'enregistrements : {count}")
    print(f"📁 Chemin : {db_path.absolute()}")
    print(f"\n🔗 URI pour Superset :")
    print(f"   sqlite:///{db_path.absolute()}")
    print(f"\n📝 Table : stock_simulation")
    print(f"\n🏷️  Colonnes :")
    print(f"   - Simulation_run")
    print(f"   - Probe_instance")
    print(f"   - Probe_run (X-Axis)")
    print(f"   - StockMeasure (Y-Axis)")
    print(f"   - csm_run_id")
    print(f"   - run_name (Series)")

if __name__ == '__main__':
    create_database()
