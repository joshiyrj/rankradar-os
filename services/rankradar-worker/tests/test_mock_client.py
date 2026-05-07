import unittest
import asyncio
from app.datadive_client import MockDataDiveClient


class MockClientTests(unittest.TestCase):
    def test_mock_provider_products(self):
        async def run():
            client = MockDataDiveClient()
            products = await client.list_rank_radar_products(brand_id="brand-orion", marketplace="US")
            self.assertTrue(products)
            self.assertTrue(all(p["brand_id"] == "brand-orion" for p in products))
        asyncio.run(run())

    def test_connection(self):
        async def run():
            client = MockDataDiveClient()
            status = await client.test_connection()
            self.assertTrue(status["ok"])
        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
