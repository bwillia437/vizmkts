from otree.api import (
    models, BaseConstants
)
from otree_markets import models as markets_models
from otree_markets.exchange.base import Order, OrderStatusEnum
from .configmanager import MarketConfig
import math


class Constants(BaseConstants):
    name_in_url = 'otree_visual_markets'
    players_per_group = None
    num_rounds = 99 

class Subsession(markets_models.Subsession):

    @property
    def config(self):
        config_name = self.session.config['session_config_file']
        return MarketConfig.get(config_name, self.round_number)
    
    def allow_short(self):
        return self.config.allow_short

    def creating_session(self):
        if self.round_number > self.config.num_rounds:
            return
        return super().creating_session()
    
    def utility(self, x, y):
        return eval(
            self.config.utility_function,
            globals=math.__dict__,
            locals={'x', x, 'y', y}
        )


class Group(markets_models.Group):

    def confirm_enter(self, order):
        exchange = order.exchange
        try:
            # query for active orders in the same exchange as the new order, from the same player
            old_order = (
                exchange.orders
                    .filter(pcode=order.pcode, is_bid=order.is_bid, status=OrderStatusEnum.ACTIVE)
                    .exclude(id=order.id)
                    .get()
            )
        except Order.DoesNotExist: 
            pass
        else:
            # if another order exists, cancel it
            exchange.cancel_order(old_order.id)

        super().confirm_enter(order)


class Player(markets_models.Player):

    def asset_endowment(self):
        return self.subsession.config.x_endowment
    
    def cash_endowment(self):
        return self.subsession.config.y_endowment