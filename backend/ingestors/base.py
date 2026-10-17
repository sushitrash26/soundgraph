from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseIngestor(ABC):
    @abstractmethod
    def fetch_user_profile(self) -> Dict[str, Any]:
        """Returns dict with keys: id, name, source, avatar_url"""
        pass

    @abstractmethod
    def fetch_listening_data(self) -> List[Dict[str, Any]]:
        """Returns list of normalized tracks with features, artists, genres"""
        pass
