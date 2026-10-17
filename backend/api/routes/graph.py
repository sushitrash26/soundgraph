from fastapi import APIRouter
from backend.graph.queries import GraphQueries
from backend.gds.projections import GDSProjectionManager
from backend.gds.similarity import GDSSimilarity
from backend.gds.pagerank import GDSPageRank
from backend.gds.community import GDSCommunity

router = APIRouter(prefix="/graph", tags=["Graph Visualizer & Operations"])

@router.get("/stats")
def get_stats():
    return GraphQueries.get_graph_stats()

@router.get("/explore")
def get_graph_exploration(limit: int = 150):
    return GraphQueries.get_graph_visualization(limit=limit)

@router.post("/gds/run")
def run_gds_manually():
    GDSProjectionManager.project_taste_graph()
    sim_res = GDSSimilarity.run_node_similarity()
    pr_res = GDSPageRank.run_pagerank()
    com_res = GDSCommunity.run_louvain()
    return {
        "status": "success",
        "similarity": sim_res,
        "pagerank": pr_res,
        "community": com_res
    }
