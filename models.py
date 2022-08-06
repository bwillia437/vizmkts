from otree.api import (
    models, BaseConstants
)
from otree_markets import models as markets_models
from otree_markets.exchange.base import Order, OrderStatusEnum
from .configmanager import MarketConfig
import itertools

import js2py


class Constants(BaseConstants):
    name_in_url = 'otree_visual_markets'
    players_per_group = None
    num_rounds = 99 

class Subsession(markets_models.Subsession):

    @property
    def config(self):
        config_name = self.session.config['session_config_file']
        return MarketConfig.get(config_name, self.round_number)

    def do_grouping(self):
        ppg = self.config.players_per_group
        # if ppg is None, just use the default grouping where everyone is in one group
        if not ppg:
            return
        group_matrix = []
        players = self.get_players()
        for i in range(0, len(players), ppg):
            group_matrix.append(players[i:i+ppg])
        self.set_group_matrix(group_matrix)

    def creating_session(self):
        if self.round_number > self.config.num_rounds:
            return
        self.do_grouping()
        return super().creating_session()
    

class Group(markets_models.Group):

    def period_length(self):
        return self.subsession.config.period_length
    
    def post_round_delay(self):
        return self.subsession.config.post_round_delay

    def _on_enter_event(self, event):
        # get_end_time returns a timestamp if the round has ended and None otherwise
        if self.get_end_time():
            print('warning: a player attempted to enter an order after the round ended')
            return
        return super()._on_enter_event(event)
    
    def _on_accept_event(self, event):
        if self.get_end_time():
            print('warning: a player attempted to accept an order after the round ended')
            return
        return super()._on_accept_event(event)
    
    def _on_cancel_event(self, event):
        if self.get_end_time():
            print('warning: a player attempted to cancel an order after the round ended')
            return
        return super()._on_cancel_event(event)

    def confirm_enter(self, order):
        player = self.get_player(order.pcode)
        player.refresh_from_db()
        exchange = self.exchanges.get()

        if order.is_bid:
            if player.current_bid:
                exchange.cancel_order(player.current_bid.id)
            player.current_bid = order
            player.save()
        else:
            if player.current_ask:
                exchange.cancel_order(player.current_ask.id)
            player.current_ask = order
            player.save()

        super().confirm_enter(order)
    
    def set_payoffs(self):
        for player in self.get_players():
            player.set_payoff()

    def confirm_trade(self, trade):
        exchange = self.exchanges.get()
        for order in itertools.chain(trade.making_orders.all(), [trade.taking_order]):
            player = self.get_player(order.pcode)
            player.refresh_from_db()

            # if the order from this trade is the current order for that player, update their current order to None.
            # if the order from this trade is NOT the current order for that player, cancel it.
            # the exception to this is if the price on the trade order and current order are the same, we assume the current
            # order is a partially completed order from this trade and don't cancel it
            if order.is_bid and player.current_bid:
                if order.id == player.current_bid.id:
                    player.current_bid = None
                    player.save()
                elif order.price != player.current_bid.price:
                    exchange.cancel_order(player.current_bid.id)

            if not order.is_bid and player.current_ask:
                if order.id == player.current_ask.id:
                    player.current_ask = None
                    player.save()
                elif order.price != player.current_ask.price:
                    exchange.cancel_order(player.current_ask.id)

        super().confirm_trade(trade)
    
    def confirm_cancel(self, order):
        player = self.get_player(order.pcode)
        player.refresh_from_db()
        if order.is_bid:
            player.current_bid = None
        else:
            player.current_ask = None
        player.save()

        super().confirm_cancel(order)
        
   
class Player(markets_models.Player):

    current_bid = models.ForeignKey(Order, null=True, on_delete=models.CASCADE, related_name="+")
    current_ask = models.ForeignKey(Order, null=True, on_delete=models.CASCADE, related_name="+")

    @property
    def config(self):
        config_name = self.session.config['session_config_file']
        return MarketConfig.get(config_name, self.round_number, self.id_in_group)
    
    def utility_function(self, x, y):
        return js2py.eval_js('function $(x, y) { return ' + self.config.utility_function + '; }')(x, y)

    def set_payoff(self):
        config = self.config

        initial_utility = self.utility_function(config.x_endowment, config.y_endowment)
        current_x = self.settled_assets[markets_models.SINGLE_ASSET_NAME] / config.x_currency_scale
        current_y = self.settled_cash / config.y_currency_scale
        current_utility = self.utility_function(current_x, current_y)

        initial_payoff = initial_utility * config.payoff_initial_multiplier
        gains_payoff = (current_utility - initial_utility) * config.payoff_gain_multiplier

        gains_payoff = max(gains_payoff, -initial_utility)
        self.payoff = (initial_payoff + gains_payoff) * 1000
    
    def get_unscaled_payoff(self):
        return float(self.payoff) / 1000

    def asset_endowment(self):
        config = self.config
        return config.x_endowment * config.x_currency_scale
    
    def cash_endowment(self):
        config = self.config
        return config.y_endowment * config.y_currency_scale

    def check_available(self, is_bid, price, volume, asset_name):
        '''since each player can only ever have one order entered at a time, we ignore available holdings
        when determining whether an order can be entered'''
        if is_bid and self.settled_cash < price * volume:
            return False
        elif not is_bid and self.settled_assets[asset_name] < volume:
            return False
        return True
