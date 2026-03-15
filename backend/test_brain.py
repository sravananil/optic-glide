from app.brain_rag import RagBrain
b = RagBrain()
print('RagBrain ok, model=', b.model, 'fast_model=', getattr(b,'fast_model',None))
print('Process noise test:', b.process('uh','general'))
print('Process keyword test:', b.process('show me brain','general'))
